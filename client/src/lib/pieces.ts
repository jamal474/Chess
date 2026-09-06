// Chess piece model. Pieces are identified by (color, id) — id being one of
// "pawn1".."pawn8", "rook1", "rook2", "knight1", "knight2", "bishop1",
// "bishop2", "queen", "king" — the same identifiers the C++ engine uses.
//
// Rendering is a Unicode glyph resolved in glyphs.ts; nothing in this file
// references any image or asset, so pieces are cheap to construct and swap.

import { PLAYER1, PLAYER2, type PlayerId, type SquareId } from "./types";

export type PieceColor = "W" | "B";
export type Piece = {
  color: PieceColor;
  id: string;      // "pawn3", "rook1", "queen", "king", …
  square: SquareId;
};

export function pieceKey(p: { color: PieceColor; id: string }) {
  return `${p.color}-${p.id}`;
}

export function strPosition(pos: { x: number; y: number }): SquareId {
  return `${pos.x}${pos.y}`;
}
export function objPosition(id: SquareId): { x: number; y: number } {
  return { x: Number(id[0]), y: Number(id[1]) };
}

export function ownColor(playerId: PlayerId): PieceColor {
  return playerId === PLAYER1 ? "W" : "B";
}
export function oppositePlayer(id: PlayerId): PlayerId {
  return id === PLAYER1 ? PLAYER2 : PLAYER1;
}

// Standard starting layout.
export function initialPieces(): Piece[] {
  const pieces: Piece[] = [];
  const back: Record<number, string> = {
    1: "rook1",
    2: "knight1",
    3: "bishop1",
    4: "queen",
    5: "king",
    6: "bishop2",
    7: "knight2",
    8: "rook2",
  };
  for (let col = 1; col <= 8; col++) {
    pieces.push({ color: "W", id: `pawn${col}`, square: `2${col}` });
    pieces.push({ color: "B", id: `pawn${col}`, square: `7${col}` });
  }
  for (let col = 1; col <= 8; col++) {
    pieces.push({ color: "W", id: back[col], square: `1${col}` });
    pieces.push({ color: "B", id: back[col], square: `8${col}` });
  }
  return pieces;
}

// Move-log entry (Standard Algebraic Notation, without disambiguators).
export function moveNotation(pieceId: string, newPos: SquareId, captured: boolean): string {
  const row = newPos[0];
  const col = Number(newPos[1]);
  const colAlpha = String.fromCharCode(96 + col); // 1->a, 2->b, ...
  const target = colAlpha + row;
  const cap = captured ? "x" : "";
  let ch = "";
  if (pieceId.startsWith("bishop")) ch = "B";
  else if (pieceId.startsWith("knight")) ch = "N";
  else if (pieceId.startsWith("rook")) ch = "R";
  else if (pieceId.startsWith("queen")) ch = "Q";
  else if (pieceId.startsWith("king")) ch = "K";
  return ch + cap + target;
}
