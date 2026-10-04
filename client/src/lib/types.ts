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

// ---------- Players ----------

export type Country = { code: string; name: string };
/** What a player tells the room about themselves. */
export type Profile = { name: string; country: Country | null };
export type Profiles = Record<PlayerId, Profile | null>;

// ---------- Undo requests ----------

/** Mirrors the relay's RoomRegistry.undoState(). */
export type UndoState = {
  max: number;
  used: Record<PlayerId, number>;
  pending: { by: PlayerId; expiresIn: number } | null;
  /** Local time this state arrived; with pending.expiresIn gives the deadline. */
  receivedAt?: number;
};
export type UndoEvent = {
  type: "requested" | "accepted" | "declined" | "cancelled" | "expired" | "failed";
  by: PlayerId;
};

// ---------- End of game ----------

export type GameResult =
  | { kind: "checkmate"; winner: PlayerId }
  | { kind: "resign"; winner: PlayerId }
  | { kind: "stalemate"; winner: null };

// ---------- Who's in the room ----------

/** A started game pauses while a seat is empty. `left` is who just left, if anyone. */
export type Presence = {
  seats: Record<PlayerId, boolean>;
  paused: boolean;
  left: PlayerId | null;
  /** Seconds played, pauses excluded. */
  elapsed: number;
};
