const { PLAYER } = require("../constants");

/**
 * Rebuilds the position from the recorded moves, in the browser's shape, for
 * a player who takes over a seat mid-game.
 *
 * The engine doesn't do castling or en passant, so every move is one piece
 * from one square to another, capturing whatever stood there, plus an
 * optional promotion. Squares are "xy" strings (x = rank, y = file), piece
 * ids are the engine's; a promoted pawn renders as "<kind>__<pawnId>".
 */

const BACK_RANK = ["rook1", "knight1", "bishop1", "queen", "king", "bishop2", "knight2", "rook2"];
const colorOf = (player) => (player === PLAYER.PLAYER1 ? "W" : "B");
const key = (p) => `${p.x}${p.y}`;

function initialBoard() {
  const board = new Map();
  for (let f = 1; f <= 8; f++) {
    board.set(`2${f}`, { color: "W", id: `pawn${f}` });
    board.set(`7${f}`, { color: "B", id: `pawn${f}` });
    board.set(`1${f}`, { color: "W", id: BACK_RANK[f - 1] });
    board.set(`8${f}`, { color: "B", id: BACK_RANK[f - 1] });
  }
  return board;
}

/** Same notation as the browser's move log (client/src/lib/pieces.ts moveNotation). */
function notation(pieceId, to, captured, from) {
  const target = String.fromCharCode(96 + to.y) + to.x;
  let ch = "";
  if (pieceId.startsWith("bishop")) ch = "B";
  else if (pieceId.startsWith("knight")) ch = "N";
  else if (pieceId.startsWith("rook")) ch = "R";
  else if (pieceId.startsWith("queen")) ch = "Q";
  else if (pieceId.startsWith("king")) ch = "K";
  const pawnFile = !ch && captured ? String.fromCharCode(96 + from.y) : "";
  return ch + pawnFile + (captured ? "x" : "") + target;
}

/**
 * @param {Array<{player, pieceId, from:{x,y}, to:{x,y}, promo}>} moves
 * @returns {{ pieces, moveRows, recentMove }}
 */
function buildSnapshot(moves) {
  const board = initialBoard();
  const rows = [];
  let recentMove = null;

  for (const m of moves) {
    const fromKey = key(m.from);
    const toKey = key(m.to);
    const color = colorOf(m.player);
    // Find the mover by engine id (it may have been promoted: "queen__pawn3").
    let moverKey = fromKey;
    const atFrom = board.get(fromKey);
    if (!atFrom || atFrom.color !== color) {
      for (const [k, p] of board) {
        if (p.color === color && (p.id === m.pieceId || p.id.endsWith(`__${m.pieceId}`))) moverKey = k;
      }
    }
    const mover = board.get(moverKey);
    if (!mover) continue; // record out of step with the board; skip rather than crash
    const captured = board.has(toKey);
    const text = notation(mover.id, m.to, captured, m.from);

    board.delete(moverKey);
    board.set(toKey, m.promo ? { color, id: `${m.promo}__${m.pieceId}` } : mover);

    if (m.player === PLAYER.PLAYER1) rows.push({ i: rows.length + 1, white: text, black: "" });
    else if (rows.length > 0) rows[rows.length - 1] = { ...rows[rows.length - 1], black: text };
    else rows.push({ i: 1, white: "", black: text });
    recentMove = { from: fromKey, to: toKey };
  }

  const pieces = [...board].map(([square, p]) => ({ color: p.color, id: p.id, square }));
  return { pieces, moveRows: rows, recentMove };
}

module.exports = { buildSnapshot };
