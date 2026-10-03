// Replays a list of moves through the real C++ engine.
//
// Each move goes through the same engine requests a player's move would:
//   valid_moves      → is the target in the engine's legal list?
//   update_position  → applies it (and promotes a pawn reaching the last rank)
// so a loaded position is exactly what the engine would hold after those
// moves were played by hand. Requests go straight to CppClient, bypassing
// GameEngine's dispatch, so nothing is broadcast per move; the caller sends
// one snapshot at the end.

const { PLAYER, CPP_REQ, STATUS } = require("../constants");
const { Position, KIND_LETTER, alg, key, colorName } = require("./position");

class ReplayError extends Error {
  constructor(message, { ply, token } = {}) {
    super(message);
    this.ply = ply;
    this.token = token;
  }
}

/**
 * @param {object} args
 * @param {import("../cpp/CppClient").CppClient} args.cpp
 * @param {string}   args.roomId
 * @param {Array<string|{player:string,from:{x,y},to:{x,y},promo?:string}>} args.moves
 *        PGN tokens, or structured moves (used when re-exporting history)
 * @param {number}  [args.upto]  number of plies to apply (default: all)
 * @param {boolean} [args.resetEngine=true]
 */
async function replay({ cpp, roomId, moves, upto = moves.length, resetEngine = true }) {
  const position = new Position();
  const history = [];
  const san = [];
  const rows = [];
  let recentMove = null;

  if (resetEngine) await call(cpp, { req_id: CPP_REQ.RESET, room_id: roomId }, "reset the engine room");

  const count = Math.max(0, Math.min(upto, moves.length));
  for (let i = 0; i < count; i++) {
    const ply = i + 1;
    const player = i % 2 === 0 ? PLAYER.PLAYER1 : PLAYER.PLAYER2;
    const token = typeof moves[i] === "string" ? moves[i] : null;
    const label = token ?? `${alg(moves[i].from)}${alg(moves[i].to)}`;
    const fail = (msg) => new ReplayError(`move ${moveNumber(ply)} "${label}": ${msg}`, { ply, token: label });

    // Narrow the token to candidate pieces, then let the engine pick the legal one.
    let interpreted;
    try {
      interpreted = token
        ? position.interpret(token, player)
        : {
            candidates: [{ pieceId: position.at(moves[i].from)?.id, from: moves[i].from, to: moves[i].to }],
            promo: moves[i].promo || null,
          };
    } catch (err) {
      throw fail(err.message);
    }

    const legal = [];
    for (const c of interpreted.candidates) {
      if (!c.pieceId) continue;
      const res = await call(cpp, {
        req_id: CPP_REQ.VALID_MOVES, room_id: roomId, player_id: player, piece_id: c.pieceId,
      }, "ask the engine for legal moves");
      const targets = Array.isArray(res.position_array) ? res.position_array : [];
      if (targets.some((p) => p && p.x === c.to.x && p.y === c.to.y)) legal.push(c);
    }
    if (legal.length === 0) throw fail(`not a legal move for ${colorName(player)} here (per the engine)`);
    if (legal.length > 1) {
      throw fail(`ambiguous; could be ${legal.map((c) => alg(c.from)).join(" or ")}. Add the file or rank`);
    }
    const move = { player, ...legal[0], promo: interpreted.promo };

    const lastRank = player === PLAYER.PLAYER1 ? 8 : 1;
    const promotes = position.at(move.from)?.kind === "pawn" && move.to.x === lastRank;
    if (move.promo && !promotes) throw fail("only a pawn reaching the last rank can promote");

    const sanText = position.san(move);
    const logText = position.logNotation(move);

    const res = await call(cpp, {
      req_id: CPP_REQ.UPDATE_POSITION, room_id: roomId, player_id: player, piece_id: move.pieceId,
      position: move.to, ...(promotes ? { promotion: move.promo || "queen" } : {}),
    }, "apply the move");
    position.apply(move);

    const promo = res.promoted_to || null;
    if (promo) position.promote(move.to, promo);

    history.push({ player, pieceId: move.pieceId, from: move.from, to: move.to, promo });
    // Auto-promotion (no "=Q" in the input) still records the promotion.
    san.push(promo && !sanText.includes("=") ? `${sanText}=${KIND_LETTER[promo]}` : sanText);
    if (player === PLAYER.PLAYER1) rows.push({ i: rows.length + 1, white: logText, black: "" });
    else if (rows.length) rows[rows.length - 1].black = logText;
    else rows.push({ i: 1, white: "…", black: logText });
    recentMove = { from: key(move.from), to: key(move.to) };
  }

  const turn = count % 2 === 0 ? PLAYER.PLAYER1 : PLAYER.PLAYER2;
  return { position, history, san, rows, recentMove, turn, ply: count, total: moves.length };
}

async function call(cpp, payload, what) {
  let res;
  try {
    res = await cpp.send(payload);
  } catch (err) {
    throw new ReplayError(`couldn't ${what}: engine unreachable (${err.message})`);
  }
  if (!res || res.status !== STATUS.SUCCESSFUL) {
    throw new ReplayError(`couldn't ${what}: engine said ${res?.status ?? "nothing"}`);
  }
  return res;
}

function moveNumber(ply) {
  return `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."}`;
}

module.exports = { replay, ReplayError };
