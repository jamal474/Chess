// What the game page reads on mount to know which room to enter, kept in
// sessionStorage so a page refresh lands back in the same game.

import type { PlayerId } from "./types";

const TICKET_KEY = "matchTicket";

/** A private room: created here, or joined by its code. */
export function enterPrivateRoom(opts: { playerId: PlayerId; roomCode: string; creator: boolean }) {
  sessionStorage.removeItem(TICKET_KEY);
  sessionStorage.setItem("playerID", opts.playerId);
  sessionStorage.setItem("isCreator", String(opts.creator));
  sessionStorage.setItem(opts.creator ? "createRoomId" : "joinRoomId", opts.roomCode);
}

/** A matchmade room: the seat is reserved for whoever holds the ticket. */
export function enterMatch(opts: { playerId: PlayerId; roomId: string; ticket: string }) {
  sessionStorage.setItem("playerID", opts.playerId);
  sessionStorage.setItem("isCreator", "false");
  sessionStorage.setItem("joinRoomId", opts.roomId);
  sessionStorage.setItem(TICKET_KEY, opts.ticket);
}

export function matchTicket(): string | null {
  return sessionStorage.getItem(TICKET_KEY);
}

export function clearMatch() {
  sessionStorage.removeItem(TICKET_KEY);
}
