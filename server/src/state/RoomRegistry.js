const { PLAYER, MAX_UNDOS } = require("../constants");
const { log } = require("../logger");

/**
 * RoomRegistry — the single source of truth for every in-flight game room.
 *
 * Two maps:
 *   * socketToRoom (socket.id → roomId): so we can find a socket's room in
 *     O(1) inside every event handler, without asking socket.io's adapter.
 *   * rooms       (roomId    → Room):    the game state itself.
 *
 * A Room lives from `create()` (creator lands) → `dispose()` (last socket
 * leaves). During gameplay we track:
 *   - whose turn it is;
 *   - the legal moves of the side to move, as pushed by the engine at the
 *     start of each turn, so pieceMove is authorised without a round-trip;
 *   - which of a player's pawns have been promoted (recorded when the engine
 *     reports a promotion);
 *   - each player's display name and country;
 *   - how many undos each player has used, and any request awaiting the
 *     opponent's answer;
 *   - which socket sits in each seat. A started game is paused while a seat
 *     is empty, and resumes for whoever takes the seat;
 *   - the moves played (so a newcomer can be sent the position) and the
 *     game clock.
 */
class RoomRegistry {
  constructor() {
    /** @type {Map<string, string>} socket.id → roomId */
    this._socketToRoom = new Map();
    /** @type {Map<string, Room>}   roomId → Room */
    this._rooms = new Map();
  }

  // ---------- socket lifecycle ----------

  bindSocket(socketId, roomId) {
    this._socketToRoom.set(socketId, roomId);
  }

  roomIdFor(socketId) {
    return this._socketToRoom.get(socketId) || null;
  }

  /** Returns the roomId the socket was in, or null if unknown. */
  unbindSocket(socketId) {
    const roomId = this._socketToRoom.get(socketId) || null;
    this._socketToRoom.delete(socketId);
    return roomId;
  }

  // ---------- room lifecycle ----------

  create(roomId, creatorId) {
    this._rooms.set(roomId, {
      roomId,
      creatorId,
      turn: null, // populated by startGame() after the engine confirms
      players: {
        [PLAYER.PLAYER1]: { moveMap: {}, alreadyPromotedPawns: [] },
        [PLAYER.PLAYER2]: { moveMap: {}, alreadyPromotedPawns: [] },
      },
      profiles: { [PLAYER.PLAYER1]: null, [PLAYER.PLAYER2]: null },
      undo: freshUndo(),
      seats: { [PLAYER.PLAYER1]: null, [PLAYER.PLAYER2]: null },
      paused: false,
      over: false,
      moves: [],   // { player, pieceId, from, to, promo }
      undone: [],  // the engine keeps one level of redo
      clock: freshClock(),
      // Rooms made by the matchmaker: { tickets: { pl1, pl2 } }. Seats are
      // reserved; only the holder of a seat's ticket may take it.
      match: null,
    });
    log.debug("rooms", `create room=${roomId} creator=${creatorId}`);
  }

  dispose(roomId) {
    this.clearPendingUndo(roomId);
    this.clearAbandon(roomId);
    if (this._rooms.delete(roomId)) log.debug("rooms", `dispose room=${roomId}`);
  }

  has(roomId) {
    return this._rooms.has(roomId);
  }

  get(roomId) {
    return this._rooms.get(roomId) || null;
  }

  size() {
    return this._rooms.size;
  }

  /** Called after the engine says create_room / reset succeeded. */
  startGame(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    room.turn = PLAYER.PLAYER1;
    room.players[PLAYER.PLAYER1] = { moveMap: {}, alreadyPromotedPawns: [] };
    room.players[PLAYER.PLAYER2] = { moveMap: {}, alreadyPromotedPawns: [] };
    this.clearPendingUndo(roomId);
    this.clearAbandon(roomId);
    room.undo = freshUndo();
    room.over = false;
    room.result = null;
    room.moves = [];
    room.undone = [];
    room.clock = freshClock();
    room.clock.startedAt = Date.now();
  }

  currentTurn(roomId) {
    return this._rooms.get(roomId)?.turn ?? null;
  }

  setTurn(roomId, playerId) {
    const room = this._rooms.get(roomId);
    if (room) room.turn = playerId;
  }

  swapTurn(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    room.turn = room.turn === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1;
    return room.turn;
  }

  // ---------- per-turn move authorisation ----------

  /** Replaces a player's legal moves for this turn: { [pieceId]: [{x,y}, …] }. */
  setLegalMoves(roomId, playerId, movesByPiece) {
    const player = this._rooms.get(roomId)?.players?.[playerId];
    if (player) player.moveMap = { ...movesByPiece };
  }

  /** Forgets both players' legal moves (while a move is being applied, after resign, …). */
  clearLegalMoves(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    for (const p of Object.values(room.players)) p.moveMap = {};
  }

  storeValidMoves(roomId, playerId, pieceId, positions) {
    const player = this._rooms.get(roomId)?.players?.[playerId];
    if (!player) return;
    player.moveMap[pieceId] = positions;
  }

  storedValidMoves(roomId, playerId, pieceId) {
    return this._rooms.get(roomId)?.players?.[playerId]?.moveMap?.[pieceId] || null;
  }

  // ---------- pawn-promotion bookkeeping ----------

  getAlreadyPromoted(roomId, playerId) {
    return this._rooms.get(roomId)?.players?.[playerId]?.alreadyPromotedPawns || [];
  }

  setAlreadyPromoted(roomId, playerId, list) {
    const player = this._rooms.get(roomId)?.players?.[playerId];
    if (!player) return;
    player.alreadyPromotedPawns = Array.isArray(list) ? list : [];
  }

  // ---------- seats ----------

  /** Puts a socket in a seat. */
  sit(roomId, playerId, socketId) {
    const room = this._rooms.get(roomId);
    if (room && playerId in room.seats) room.seats[playerId] = socketId;
  }

  /** Empties whichever seat the socket held; returns that seat's playerId or null. */
  stand(roomId, socketId) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    for (const p of Object.keys(room.seats)) {
      if (room.seats[p] === socketId) {
        room.seats[p] = null;
        return p;
      }
    }
    return null;
  }

  seatOf(roomId, socketId) {
    const seats = this._rooms.get(roomId)?.seats;
    if (!seats) return null;
    return Object.keys(seats).find((p) => seats[p] === socketId) ?? null;
  }

  /** The first empty seat, or null when both are taken. */
  freeSeat(roomId) {
    const seats = this._rooms.get(roomId)?.seats;
    if (!seats) return null;
    return Object.keys(seats).find((p) => !seats[p]) ?? null;
  }

  isSeatFree(roomId, playerId) {
    const seats = this._rooms.get(roomId)?.seats;
    return Boolean(seats && playerId in seats && !seats[playerId]);
  }

  occupied(roomId) {
    const seats = this._rooms.get(roomId)?.seats;
    return seats ? Object.values(seats).filter(Boolean).length : 0;
  }

  // ---------- matchmade rooms ----------

  setMatch(roomId, match) {
    const room = this._rooms.get(roomId);
    if (room) room.match = match;
  }

  /** The match record of a matchmade room, or null for a private room. */
  match(roomId) {
    return this._rooms.get(roomId)?.match ?? null;
  }

  /** The seat a ticket reserves, or null. */
  seatForTicket(roomId, ticket) {
    const tickets = this._rooms.get(roomId)?.match?.tickets;
    if (!tickets || typeof ticket !== "string") return null;
    return Object.keys(tickets).find((p) => tickets[p] === ticket) ?? null;
  }

  /** Players seated in games that have started. */
  playingCount() {
    let n = 0;
    for (const room of this._rooms.values()) {
      if (!room.turn) continue;
      for (const s of Object.values(room.seats)) if (s) n++;
    }
    return n;
  }

  // ---------- pause / clock / game over ----------

  /** True once the engine has set the board up (a turn exists). */
  isStarted(roomId) {
    return Boolean(this._rooms.get(roomId)?.turn);
  }

  isPaused(roomId) {
    return Boolean(this._rooms.get(roomId)?.paused);
  }

  setPaused(roomId, paused) {
    const room = this._rooms.get(roomId);
    if (!room || room.paused === paused) return;
    room.paused = paused;
    const c = room.clock;
    if (paused) c.pausedAt = Date.now();
    else if (c.pausedAt) {
      c.pausedFor += Date.now() - c.pausedAt;
      c.pausedAt = null;
    }
  }

  /** Whole seconds the game has been played, pauses excluded. */
  elapsed(roomId) {
    const c = this._rooms.get(roomId)?.clock;
    if (!c || !c.startedAt) return 0;
    const now = c.pausedAt ?? c.stoppedAt ?? Date.now();
    return Math.max(0, Math.floor((now - c.startedAt - c.pausedFor) / 1000));
  }

  result(roomId) {
    return this._rooms.get(roomId)?.result ?? null;
  }

  isOver(roomId) {
    return Boolean(this._rooms.get(roomId)?.over);
  }

  /**
   * Checkmate, stalemate, resignation or abandonment: the clock stops.
   * `result` is { kind, winner } as the browsers know it, kept so a player
   * who reloads a finished game sees how it ended.
   */
  setOver(roomId, result = null) {
    const room = this._rooms.get(roomId);
    if (!room || room.over) return;
    room.over = true;
    room.result = result;
    room.clock.stoppedAt = room.clock.pausedAt ?? Date.now();
  }

  // ---------- abandonment (matchmade games) ----------

  /** Starts the countdown after which `seat` loses for not coming back. */
  setAbandon(roomId, seat, deadline, timer) {
    const room = this._rooms.get(roomId);
    if (!room) return clearTimeout(timer);
    this.clearAbandon(roomId);
    room.abandon = { seat, deadline, timer };
  }

  /** Returns the countdown that was running (and stops it), or null. */
  clearAbandon(roomId) {
    const room = this._rooms.get(roomId);
    const a = room?.abandon ?? null;
    if (a) {
      clearTimeout(a.timer);
      room.abandon = null;
    }
    return a;
  }

  abandoning(roomId) {
    return this._rooms.get(roomId)?.abandon ?? null;
  }

  /** What the browsers are told about who's here. */
  presence(roomId, left = null) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    return {
      seats: {
        [PLAYER.PLAYER1]: Boolean(room.seats[PLAYER.PLAYER1]),
        [PLAYER.PLAYER2]: Boolean(room.seats[PLAYER.PLAYER2]),
      },
      paused: room.paused,
      left,
      elapsed: this.elapsed(roomId),
      // ms until an absent player in a matchmade game loses, if counting down.
      abandonIn: room.abandon ? Math.max(0, room.abandon.deadline - Date.now()) : null,
    };
  }

  // ---------- move record (for snapshots) ----------

  recordMove(roomId, move) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    room.moves.push({ ...move, promo: null });
    room.undone = [];
  }

  recordPromotion(roomId, newPieceId) {
    const last = this._rooms.get(roomId)?.moves.at(-1);
    if (last) last.promo = newPieceId;
  }

  recordUndo(roomId) {
    const room = this._rooms.get(roomId);
    const m = room?.moves.pop();
    if (m) room.undone.push(m);
  }

  recordRedo(roomId) {
    const room = this._rooms.get(roomId);
    const m = room?.undone.pop();
    if (m) room.moves.push(m);
  }

  /** Replaces the record wholesale (dev tools after loading a game). */
  setMoves(roomId, moves) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    room.moves = moves.map((m) => ({ player: m.player, pieceId: m.pieceId, from: m.from, to: m.to, promo: m.promo ?? null }));
    room.undone = [];
  }

  moves(roomId) {
    return this._rooms.get(roomId)?.moves.slice() ?? [];
  }

  // ---------- player profiles ----------

  setProfile(roomId, playerId, profile) {
    const room = this._rooms.get(roomId);
    if (room && playerId in room.profiles) room.profiles[playerId] = profile;
  }

  profiles(roomId) {
    return this._rooms.get(roomId)?.profiles ?? null;
  }

  // ---------- undo requests ----------

  /**
   * What the browsers are told: { max, used: {pl1, pl2}, pending: { by, expiresIn } | null }.
   * expiresIn (ms from now) rather than a timestamp, so the browsers' clocks don't matter.
   */
  undoState(roomId) {
    const undo = this._rooms.get(roomId)?.undo;
    if (!undo) return null;
    const p = undo.pending;
    return {
      max: MAX_UNDOS,
      used: { ...undo.used },
      pending: p ? { by: p.by, expiresIn: Math.max(0, p.expiresAt - Date.now()) } : null,
    };
  }

  undosLeft(roomId, playerId) {
    const undo = this._rooms.get(roomId)?.undo;
    return undo ? Math.max(0, MAX_UNDOS - (undo.used[playerId] ?? 0)) : 0;
  }

  pendingUndo(roomId) {
    return this._rooms.get(roomId)?.undo?.pending ?? null;
  }

  /** `timer` is cleared whenever the request ends, however it ends. */
  setPendingUndo(roomId, by, expiresAt, timer) {
    const room = this._rooms.get(roomId);
    if (!room) return clearTimeout(timer);
    this.clearPendingUndo(roomId);
    room.undo.pending = { by, expiresAt, timer };
  }

  /** Returns the request that was pending, or null. */
  clearPendingUndo(roomId) {
    const undo = this._rooms.get(roomId)?.undo;
    const pending = undo?.pending ?? null;
    if (pending) {
      clearTimeout(pending.timer);
      undo.pending = null;
    }
    return pending;
  }

  countUndo(roomId, playerId) {
    const undo = this._rooms.get(roomId)?.undo;
    if (undo && playerId in undo.used) undo.used[playerId] += 1;
  }

  /** A new player in a seat starts with a full set of undos. */
  resetUndos(roomId, playerId) {
    const undo = this._rooms.get(roomId)?.undo;
    if (undo && playerId in undo.used) undo.used[playerId] = 0;
  }

  // ---------- helpers used by the room-exists check ----------

  /** The other seat's player-id (opposite of whoever created the room). */
  otherPlayerId(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    return room.creatorId === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1;
  }
}

function freshClock() {
  return { startedAt: null, pausedAt: null, pausedFor: 0, stoppedAt: null };
}

function freshUndo() {
  return { used: { [PLAYER.PLAYER1]: 0, [PLAYER.PLAYER2]: 0 }, pending: null };
}

module.exports = { RoomRegistry };
