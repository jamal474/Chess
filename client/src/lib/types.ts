// Shared enums / types used by the client.
export const PLAYER1 = "pl1" as const;
export const PLAYER2 = "pl2" as const;
export type PlayerId = typeof PLAYER1 | typeof PLAYER2;

export type PosObj = { x: number; y: number };

// A single square on the DOM. Rows: 1..8 (chess rank), cols: 1..8 (file).
// The string form the server & client swap around is `${row}${col}`, e.g. "24".
export type SquareId = string;

export type PieceColor = "W" | "B";

// Board colour themes — must match the class suffixes in styles/index.css.
export const BOARD_THEMES = [
  "default",
  "dark",
  "light",
  "red",
  "blue",
  "green",
  "purple",
  "magenta",
  "orange",
] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
