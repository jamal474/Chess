// Client side of the relay's dev tools (server/src/dev). DEV ONLY: this
// folder is reached only through `import.meta.env.DEV` branches, which Vite
// removes from production builds.

import { socket } from "../lib/socket";
import { log } from "../lib/logger";
import { PLAYER1, PLAYER2, type PlayerId } from "../lib/types";

export type SavedGame = {
  name: string;
  title: string;
  description: string;
  plies: number;
  defaultPly: number;
  error?: string;
};

export type LoadSource = { name?: string; pgn?: string; ply?: number };

export type DevResult = {
  ok: boolean;
  error?: string;
  // load results
  name?: string;
  ply?: number;
  total?: number;
  tokens?: string[];
  failedPly?: number;
  token?: string;
  // other actions
  games?: SavedGame[];
  pgn?: string;
  file?: string;
  plies?: number;
};

const TIMEOUT_MS = 15_000;

function call(event: string, ...args: unknown[]): Promise<DevResult> {
  return new Promise((resolve) => {
    socket
      .timeout(TIMEOUT_MS)
      .emit(event, ...args, (err: Error | null, res: DevResult) => {
        if (err) {
          resolve({
            ok: false,
            error:
              "No answer from the relay. Is it running with DEV_TOOLS=1? (make run sets it.)",
          });
        } else {
          resolve(res);
        }
      });
  });
}

export const listGames = () => call("dev:listGames");
export const loadGame = (src: LoadSource) => call("dev:loadGame", src);
export const exportGame = () => call("dev:exportGame");
export const saveGame = (name: string, description: string, overwrite = false) =>
  call("dev:saveGame", { name, description, overwrite });

// ---------- result bus: lets the panel show results of calls it didn't make ----------

type Listener = (r: DevResult) => void;
const listeners = new Set<Listener>();
let lastResult: DevResult | null = null;

export function onDevResult(fn: Listener) {
  listeners.add(fn);
  if (lastResult) fn(lastResult);
  return () => {
    listeners.delete(fn);
  };
}
export function publish(r: DevResult) {
  lastResult = r;
  listeners.forEach((fn) => fn(r));
}

// ---------- solo games ----------

const started = new Set<string>(); // StrictMode runs effects twice; start once

/** Called by useChessGame right after createRoom when the menu asked for a solo game. */
export async function startSolo(roomCode: string) {
  if (started.has(roomCode)) return;
  started.add(roomCode);
  let load: LoadSource = {};
  try {
    load = JSON.parse(sessionStorage.getItem("devLoad") || "{}");
  } catch {
    /* ignore a malformed value */
  }
  sessionStorage.removeItem("devLoad");
  log.info("dev", `starting solo room ${roomCode}`, load);
  const res = await call("dev:startSolo", load);
  if (!res.ok) log.warn("dev", `solo: ${res.error}`);
  publish(res);
}

/** Sets up sessionStorage the way the Game page expects, for a one-tab game. */
export function prepareSoloGame(opts: { as?: PlayerId; load?: LoadSource } = {}) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "DEV";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  sessionStorage.removeItem("matchTicket");
  sessionStorage.setItem("playerID", opts.as ?? PLAYER1);
  sessionStorage.setItem("isCreator", "true");
  sessionStorage.setItem("createRoomId", code);
  sessionStorage.setItem("devSolo", "true");
  sessionStorage.setItem("devHotSeat", "true");
  if (opts.load) sessionStorage.setItem("devLoad", JSON.stringify(opts.load));
  else sessionStorage.removeItem("devLoad");
  return code;
}

/** Clears dev flags so a normal game started afterwards in this tab behaves normally. */
export function clearDevFlags() {
  for (const k of ["devSolo", "devHotSeat", "devLoad"]) sessionStorage.removeItem(k);
}

export const seatFromParam = (v: string | null): PlayerId =>
  v && /^(b|black|pl2)$/i.test(v) ? PLAYER2 : PLAYER1;
