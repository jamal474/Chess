// Browser logger — mirrors the C++/Node loggers so all three services print
// structurally identical lines. Format:
//
//   [YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] [file:line] [tag] message
//
// The runtime level comes from VITE_LOG_LEVEL at build time, with a runtime
// override via localStorage.LOG_LEVEL (browser devtools can flip it live:
//   localStorage.LOG_LEVEL = "DEBUG"; location.reload();
// ). Falls back to INFO.
//
// Usage:
//   import { log } from "./lib/logger";
//   log.info("Menu", "created room", roomCode);
//   log.error("socket", "connect failed:", err);

export const LEVELS = Object.freeze({
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
} as const);
export type LevelName = keyof typeof LEVELS;
const NAMES: LevelName[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

function parseLevel(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  const u = raw.trim().toUpperCase();
  const alias: Record<string, LevelName> = {
    WARNING: "WARN",
    ERR: "ERROR",
    CRITICAL: "FATAL",
  };
  const key = (alias[u] || u) as LevelName;
  return key in LEVELS ? LEVELS[key] : fallback;
}

function readLocalLevel(): number | null {
  try {
    return parseLevel(localStorage.getItem("LOG_LEVEL"), -1) >= 0
      ? parseLevel(localStorage.getItem("LOG_LEVEL"), LEVELS.INFO)
      : null;
  } catch {
    return null;
  }
}

let currentLevel: number =
  readLocalLevel() ??
  parseLevel(import.meta.env.VITE_LOG_LEVEL as string | undefined, LEVELS.INFO);

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function tsNow() {
  const d = new Date();
  const p2 = (x: number) => String(x).padStart(2, "0");
  const p3 = (x: number) => String(x).padStart(3, "0");
  return (
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ` +
    `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.` +
    p3(d.getMilliseconds())
  );
}

// Pull file:line from the caller's stack frame — the first frame that isn't
// inside this logger.ts.
function callSite(): string {
  const err = new Error();
  const stack = err.stack || "";
  const lines = stack.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "Error") continue;
    if (/\/logger\.tsx?[:?]/.test(line) || /\/logger\.tsx?$/.test(line)) continue;
    // Common shapes:
    //   at fn (http://host/src/foo.tsx:10:5)         (Chromium)
    //   fn@http://host/src/foo.tsx:10:5              (Firefox / Safari)
    const paren = line.match(/\(([^()]+):(\d+):\d+\)/);
    const at = line.match(/@?([^ @()]+):(\d+):\d+$/);
    const m = paren || at;
    if (m) {
      const url = m[1];
      // Strip query/fragments and keep just the basename.
      const base = url.split(/[?#]/)[0].split("/").pop() || url;
      return `${base}:${m[2]}`;
    }
  }
  return "?:?";
}

function stringifyArg(a: unknown): string {
  if (a === null || a === undefined) return String(a);
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.stack || a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function emit(levelInt: number, tag: string, args: unknown[]) {
  if (levelInt < currentLevel) return;
  const msg = args.map(stringifyArg).join(" ");
  const line = `[${tsNow()}] [${pad(NAMES[levelInt], 5)}] [${callSite()}] [${tag}] ${msg}`;
  // Route by severity so the browser applies its own colours + filter chips.
  if (levelInt >= LEVELS.ERROR) console.error(line);
  else if (levelInt === LEVELS.WARN) console.warn(line);
  else if (levelInt <= LEVELS.DEBUG) console.debug(line);
  else console.log(line);
}

export const log = {
  trace: (tag: string, ...args: unknown[]) => emit(LEVELS.TRACE, tag, args),
  debug: (tag: string, ...args: unknown[]) => emit(LEVELS.DEBUG, tag, args),
  info:  (tag: string, ...args: unknown[]) => emit(LEVELS.INFO,  tag, args),
  warn:  (tag: string, ...args: unknown[]) => emit(LEVELS.WARN,  tag, args),
  error: (tag: string, ...args: unknown[]) => emit(LEVELS.ERROR, tag, args),
  fatal: (tag: string, ...args: unknown[]) => emit(LEVELS.FATAL, tag, args),

  setLevel(nameOrInt: LevelName | number) {
    currentLevel =
      typeof nameOrInt === "number"
        ? Math.max(0, Math.min(5, nameOrInt | 0))
        : parseLevel(nameOrInt, currentLevel);
  },
  level: () => NAMES[currentLevel],
};

// Expose on window for quick console tweaks: `window.chessLog.setLevel("DEBUG")`
if (typeof window !== "undefined") {
  (window as unknown as { chessLog: typeof log }).chessLog = log;
}
