// A lightweight mirror of the board, kept by the dev tools while replaying.
//
// It does NOT decide legality; the C++ engine does that. It only knows where
// each piece is, so a move token like "Nf3" can be narrowed down to the
// candidate pieces that the engine is then asked about.
//
// Coordinates follow the engine and client: x = rank (1..8), y = file (1..8,
// a=1). Piece ids are the engine's ("pawn3", "knight1", "queen", …). A
// promoted pawn keeps its engine id; the client renders it as
// "<kind>__<pawnId>", e.g. "queen__pawn3".

const { PLAYER } = require("../constants");

const KIND_LETTER = { king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "" };
const LETTER_KIND = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight" };
const BACK_RANK = ["rook1", "knight1", "bishop1", "queen", "king", "bishop2", "knight2", "rook2"];

const colorOf = (playerId) => (playerId === PLAYER.PLAYER1 ? "W" : "B");
const kindOfId = (id) => id.replace(/\d+$/, "");

function sq(alg) {
  const m = /^([a-h])([1-8])$/.exec(alg);
  if (!m) throw new Error(`bad square "${alg}"`);
  return { x: Number(m[2]), y: m[1].charCodeAt(0) - 96 };
}
const alg = (p) => String.fromCharCode(96 + p.y) + p.x;
const key = (p) => `${p.x}${p.y}`; // client SquareId

class Position {
  constructor() {
    /** @type {Map<string, {player:string, id:string, kind:string}>} keyed by "xy" */
    this.board = new Map();
    /** Engine ids of every pawn that has been promoted, captured or not. */
    this.promoted = { [PLAYER.PLAYER1]: new Set(), [PLAYER.PLAYER2]: new Set() };
    for (let f = 1; f <= 8; f++) {
      this._put({ x: 2, y: f }, PLAYER.PLAYER1, `pawn${f}`);
      this._put({ x: 7, y: f }, PLAYER.PLAYER2, `pawn${f}`);
      this._put({ x: 1, y: f }, PLAYER.PLAYER1, BACK_RANK[f - 1]);
      this._put({ x: 8, y: f }, PLAYER.PLAYER2, BACK_RANK[f - 1]);
    }
  }

  _put(pos, player, id, kind = kindOfId(id)) {
    this.board.set(key(pos), { player, id, kind });
  }

  at(pos) {
    return this.board.get(key(pos)) || null;
  }

  /** Every square holding `player`'s pieces of `kind`. */
  find(player, kind) {
    const out = [];
    for (const [k, p] of this.board) {
      if (p.player === player && p.kind === kind) out.push({ x: Number(k[0]), y: Number(k[1]), ...p });
    }
    return out;
  }

  /**
   * Turns one move token into the candidate moves it could mean.
   * Returns { candidates: [{pieceId, from, to}], promo } where promo is the
   * engine piece name ("queen", …) or null.
   */
  interpret(token, player) {
    const clean = token.replace(/[+#!?]+$/, "");

    if (/^(O-O(-O)?|0-0(-0)?)$/i.test(clean)) {
      throw new Error("castling isn't supported by the engine yet");
    }

    // Coordinates: e2e4, e2-e4, e7e8q
    let m = /^([a-h][1-8])[-x]?([a-h][1-8])=?([qrbnQRBN])?$/.exec(clean);
    if (m) {
      const from = sq(m[1]);
      const to = sq(m[2]);
      const piece = this.at(from);
      if (!piece) throw new Error(`no piece on ${m[1]}`);
      if (piece.player !== player) throw new Error(`the piece on ${m[1]} isn't ${colorName(player)}'s`);
      return {
        candidates: [{ pieceId: piece.id, kind: piece.kind, from, to }],
        promo: m[3] ? LETTER_KIND[m[3].toUpperCase()] : null,
      };
    }

    // SAN: [piece][file][rank][x]target[=promo]
    m = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=?([QRBN]))?$/.exec(clean);
    if (!m) throw new Error("couldn't read this move");
    const [, letter, file, rank, , target, promoLetter] = m;
    const kind = letter ? LETTER_KIND[letter] : "pawn";
    const to = sq(target);

    let pieces = this.find(player, kind);
    if (file) pieces = pieces.filter((p) => p.y === file.charCodeAt(0) - 96);
    if (rank) pieces = pieces.filter((p) => p.x === Number(rank));
    if (kind === "pawn" && !file) pieces = pieces.filter((p) => p.y === to.y);
    if (pieces.length === 0) throw new Error(`no ${colorName(player)} ${kind} can make this move`);

    return {
      candidates: pieces.map((p) => ({ pieceId: p.id, kind, from: { x: p.x, y: p.y }, to })),
      promo: promoLetter ? LETTER_KIND[promoLetter] : null,
    };
  }

  /** Applies a move the engine already accepted. Returns { captured, promotes }. */
  apply({ player, pieceId, from, to }) {
    const mover = this.at(from);
    const captured = this.at(to);
    this.board.delete(key(from));
    this.board.set(key(to), mover);
    const lastRank = player === PLAYER.PLAYER1 ? 8 : 1;
    const promotes = mover.kind === "pawn" && to.x === lastRank;
    return { captured: Boolean(captured), promotes, pieceId };
  }

  promote(pos, kind) {
    const p = this.at(pos);
    if (!p) return;
    p.kind = kind;
    this.promoted[p.player].add(p.id);
  }

  /** SAN for a move about to be played from this position (call before apply). */
  san({ player, from, to, promo }) {
    const mover = this.at(from);
    const capture = Boolean(this.at(to));
    const target = alg(to);
    let s;
    if (mover.kind === "pawn") {
      s = (capture ? `${alg(from)[0]}x` : "") + target;
      if (promo) s += `=${KIND_LETTER[promo]}`;
    } else {
      // Disambiguate only against same-kind pieces that could also reach the
      // square. Pins aren't considered, so in rare cases this adds a file or
      // rank that isn't strictly needed, which PGN readers accept.
      const others = this.find(player, mover.kind).filter(
        (p) => !(p.x === from.x && p.y === from.y) && this.canReach(p, to)
      );
      let dis = "";
      if (others.length) {
        const sameFile = others.some((p) => p.y === from.y);
        const sameRank = others.some((p) => p.x === from.x);
        if (!sameFile) dis = alg(from)[0];
        else if (!sameRank) dis = alg(from)[1];
        else dis = alg(from);
      }
      s = KIND_LETTER[mover.kind] + dis + (capture ? "x" : "") + target;
    }
    return s;
  }

  /** Whether a (non-pawn) piece could move to `to`, ignoring checks and pins. */
  canReach(piece, to) {
    const dx = to.x - piece.x;
    const dy = to.y - piece.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax === 0 && ay === 0) return false;
    switch (piece.kind) {
      case "knight": return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
      case "king":   return ax <= 1 && ay <= 1;
      case "rook":   if (ax !== 0 && ay !== 0) return false; break;
      case "bishop": if (ax !== ay) return false; break;
      case "queen":  if (ax !== 0 && ay !== 0 && ax !== ay) return false; break;
      default: return false;
    }
    // Sliding piece: every square strictly between must be empty.
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    for (let x = piece.x + sx, y = piece.y + sy; x !== to.x || y !== to.y; x += sx, y += sy) {
      if (this.at({ x, y })) return false;
    }
    return true;
  }

  /** Short notation used by the client's move log ("Nxf3", "e4"). */
  logNotation({ from, to }) {
    const mover = this.at(from);
    const capture = Boolean(this.at(to));
    const pawnFile = mover.kind === "pawn" && capture ? alg(from)[0] : "";
    return KIND_LETTER[mover.kind] + pawnFile + (capture ? "x" : "") + alg(to);
  }

  /** Pieces in the client's shape: { color, id, square }. */
  clientPieces() {
    const out = [];
    for (const [k, p] of this.board) {
      const id = p.kind === kindOfId(p.id) ? p.id : `${p.kind}__${p.id}`;
      out.push({ color: colorOf(p.player), id, square: k });
    }
    return out;
  }

  /** Engine ids of pawns that have been promoted, per player. */
  promotedPawns(player) {
    return [...this.promoted[player]];
  }
}

function colorName(player) {
  return player === PLAYER.PLAYER1 ? "White" : "Black";
}

module.exports = { Position, KIND_LETTER, sq, alg, key, colorName };
