// Development tools for the relay: load a game from PGN straight into a
// room, start a one-tab game, and export/save the game being played.
//
// DEV ONLY. server.js requires this module only when config.DEV_TOOLS is
// true (DEV_TOOLS=1 and NODE_ENV is not "production"), and the folder is
// excluded from the Docker image by server/.dockerignore.
//
// Socket events (all take an ack callback that receives { ok, ... }):
//   dev:listGames                          → { ok, games: [...] }
//   dev:loadGame   { name | pgn, ply? }    → { ok, name, ply, total, tokens }
//   dev:startSolo  { name?, pgn?, ply? }   → starts the room with one player,
//                                            then optionally loads a game
//   dev:exportGame                         → { ok, pgn }
//   dev:saveGame   { name, description?, overwrite? } → { ok, file }
// Broadcast to the room after a load:
//   dev:state      { pieces, turn, moveRows, recentMove, ply, total, name }
//   changeTurn, legalMoves, check/checkMate/staleMate (as after any move)

const path = require("path");
const { SOCKET_EVENT, PLAYER } = require("../constants");
const { log } = require("../logger");
const { parsePgn, formatPgn } = require("./pgn");
const { Position } = require("./position");
const { replay, ReplayError } = require("./replay");
const { MoveHistory } = require("./history");
const { GameFiles, defaultPly } = require("./gameFiles");

const DEV_EVENT = Object.freeze({
  LIST_GAMES:  "dev:listGames",
  LOAD_GAME:   "dev:loadGame",
  START_SOLO:  "dev:startSolo",
  EXPORT_GAME: "dev:exportGame",
  SAVE_GAME:   "dev:saveGame",
  STATE:       "dev:state",
});

const DEFAULT_GAMES_DIR = path.resolve(__dirname, "../../../dev/games");

function createDevTools({ io, rooms, engine, cppClient, gamesDir }) {
  const files = new GameFiles(gamesDir || DEFAULT_GAMES_DIR);
  const history = new MoveHistory(engine, rooms);
  const busy = new Set(); // rooms with a replay in flight

  log.warn("dev", `DEV TOOLS ENABLED, games dir: ${files.dir}. Never enable this in production.`);

  // ---------- helpers ----------

  const roomOf = (socket) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId || !rooms.has(roomId)) throw new Error("you're not in a room");
    return roomId;
  };

  async function source({ name, pgn }) {
    if (typeof pgn === "string" && pgn.trim()) return { name: "pasted", ...parsePgn(pgn) };
    if (name) return { name, ...(await files.read(name)) };
    throw new Error("pass a saved game name or some PGN");
  }

  async function load(roomId, { name, pgn, ply }) {
    if (!rooms.currentTurn(roomId)) throw new Error("the game hasn't started yet");
    if (busy.has(roomId)) throw new Error("a load is already running in this room");
    busy.add(roomId);
    try {
      const src = await source({ name, pgn });
      const upto = Number.isInteger(ply) ? ply : defaultPly(src.tags, src.moves);
      let result;
      let failure = null;
      try {
        result = await replay({ cpp: cppClient, roomId, moves: src.moves, upto });
      } catch (err) {
        if (!(err instanceof ReplayError) || !err.ply) throw err;
        // Land on the last good position so the board, engine and relay agree.
        failure = err;
        result = await replay({ cpp: cppClient, roomId, moves: src.moves, upto: err.ply - 1 });
      }
      await sync(roomId, result, src.name);
      log.info("dev", `room=${roomId} loaded "${src.name}" at ply ${result.ply}/${result.total}`);
      const summary = { name: src.name, ply: result.ply, total: result.total, tokens: src.moves };
      if (failure) {
        return { ok: false, error: failure.message, failedPly: failure.ply, token: failure.token, ...summary };
      }
      return { ok: true, ...summary };
    } finally {
      busy.delete(roomId);
    }
  }

  /** Brings the relay's room state and both clients in line with a replay result. */
  async function sync(roomId, result, name) {
    rooms.startGame(roomId); // clears cached legal moves; turn → pl1
    rooms.setTurn(roomId, result.turn);
    for (const p of [PLAYER.PLAYER1, PLAYER.PLAYER2]) {
      rooms.setAlreadyPromoted(roomId, p, result.position.promotedPawns(p));
    }
    history.set(roomId, result.history);

    io.to(roomId).emit(DEV_EVENT.STATE, {
      name,
      ply: result.ply,
      total: result.total,
      pieces: result.position.clientPieces(),
      turn: result.turn,
      moveRows: result.rows,
      recentMove: result.recentMove,
    });
    io.to(roomId).emit(SOCKET_EVENT.CHANGE_TURN, result.turn);
    // Legal moves and check/mate status for the side to move, as after any move.
    await engine.refreshTurn(roomId);
  }

  function exportPgn(roomId, { name, description } = {}) {
    const pos = new Position();
    const san = [];
    for (const m of history.moves(roomId)) {
      let s = pos.san({ ...m, promo: m.promo });
      pos.apply(m);
      if (m.promo) {
        pos.promote(m.to, m.promo);
        if (!s.includes("=")) s += `=${{ queen: "Q", rook: "R", bishop: "B", knight: "N" }[m.promo]}`;
      }
      san.push(s);
    }
    const d = new Date();
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    return {
      pgn: formatPgn({ Event: name || "Dev game", Date: date, Description: description || "" }, san),
      plies: san.length,
    };
  }

  // ---------- socket wiring ----------

  /** Wraps a handler so it always answers its ack, and never throws into socket.io. */
  const handler = (tag, fn) => async (...args) => {
    const cb = typeof args.at(-1) === "function" ? args.pop() : () => {};
    try {
      cb(await fn(...args));
    } catch (err) {
      log.warn(`dev.${tag}`, err.message);
      cb({ ok: false, error: err.message });
    }
  };

  function attach(socket) {
    socket.on(DEV_EVENT.LIST_GAMES, handler("list", async () => ({ ok: true, games: await files.list() })));

    socket.on(DEV_EVENT.LOAD_GAME, handler("load", async (opts = {}) => load(roomOf(socket), opts)));

    socket.on(DEV_EVENT.START_SOLO, handler("solo", async (opts = {}) => {
      const roomId = roomOf(socket);
      const occupants = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
      if (rooms.currentTurn(roomId)) throw new Error("this game has already started");
      if (occupants !== 1) throw new Error("solo games need an empty room");
      // Same call a second player joining would trigger; startGame goes out to the room.
      await engine.createRoom(roomId);
      if (!rooms.currentTurn(roomId)) throw new Error("the engine didn't start the room (check its log)");
      log.info("dev", `room=${roomId} started solo`);
      if (opts.name || opts.pgn) return load(roomId, opts);
      return { ok: true };
    }));

    socket.on(DEV_EVENT.EXPORT_GAME, handler("export", async () => ({ ok: true, ...exportPgn(roomOf(socket)) })));

    socket.on(DEV_EVENT.SAVE_GAME, handler("save", async ({ name, description, overwrite } = {}) => {
      const roomId = roomOf(socket);
      if (!GameFiles.validName(name)) {
        throw new Error("game names use lowercase letters, digits, - and _ (e.g. pinned-knight)");
      }
      const { pgn, plies } = exportPgn(roomId, { name, description });
      if (plies === 0) throw new Error("no moves to save yet");
      const file = await files.write(name, pgn, { overwrite: Boolean(overwrite) });
      log.info("dev", `room=${roomId} saved ${plies} plies to ${file}`);
      return { ok: true, file: path.relative(process.cwd(), file) || file, plies };
    }));
  }

  return { attach };
}

module.exports = { createDevTools, DEV_EVENT };
