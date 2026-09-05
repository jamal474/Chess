import type { PlayerId, SquareId } from "./types";
import { PLAYER1, PLAYER2 } from "./types";

export type Piece = {
  id: string;       // e.g. "pawn1", "rook1", "knight2", "queen", "king"
  color: "W" | "B";
  square: SquareId; // "24"
  image: string;    // "/images/Wpawn.png"
};

export function strPosition(pos: { x: number; y: number }): SquareId {
  return `${pos.x}${pos.y}`;
}
export function objPosition(id: SquareId): { x: number; y: number } {
  return { x: Number(id[0]), y: Number(id[1]) };
}

// Initial layout keyed by square (rank + file).
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
    pieces.push({ id: `pawn${col}`, color: "W", square: `2${col}`, image: "/images/Wpawn.png" });
    pieces.push({ id: `pawn${col}`, color: "B", square: `7${col}`, image: "/images/Bpawn.png" });
  }
  for (let col = 1; col <= 8; col++) {
    const id = back[col];
    const cap = capitalize(strip(id));
    pieces.push({ id, color: "W", square: `1${col}`, image: `/images/W${strip(id)}.png` });
    pieces.push({ id, color: "B", square: `8${col}`, image: `/images/B${strip(id)}.png` });
    void cap;
  }
  return pieces;
}

function strip(id: string) {
  // "rook1" -> "rook", "queen" -> "queen"
  return id.replace(/\d+$/, "");
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ownColor(playerId: PlayerId): "W" | "B" {
  return playerId === PLAYER1 ? "W" : "B";
}
export function oppositePlayer(id: PlayerId): PlayerId {
  return id === PLAYER1 ? PLAYER2 : PLAYER1;
}

export function moveNotation(pieceId: string, newPos: SquareId, captured: boolean): string {
  const row = newPos[0];
  const col = newPos[1];
  const colAlpha = String.fromCharCode(97 - 1 + Number(col));
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
