// Unicode chess glyphs, keyed by piece kind. We use the "black filled" glyph
// for both colors and let CSS colour them — this keeps every piece rendered
// with the same outline weight regardless of the browser's chess font. That's
// what makes the brutalist look consistent.
//
// The "outlined white" glyphs (♔ ♕ ♖ ♗ ♘ ♙) render differently in every font
// and look flimsy against the harsh brutalist background, so we skip them.

export const GLYPH: Record<string, string> = {
  king:   "♚", // ♚
  queen:  "♛", // ♛
  rook:   "♜", // ♜
  bishop: "♝", // ♝
  knight: "♞", // ♞
  pawn:   "♟", // ♟
};

// Piece IDs come in as "pawn1".."pawn8", "rook1", "queen", etc. A promoted
// pawn keeps its original id but with the new kind as a prefix, e.g.
// "queen__pawn3" — the current kind is always what precedes "__" (if any).
// Trim any trailing digit(s) to look up the glyph.
export function glyphFor(pieceId: string): string {
  const head = pieceId.split("__")[0];
  const kind = head.replace(/\d+$/, "");
  return GLYPH[kind] ?? "?";
}
