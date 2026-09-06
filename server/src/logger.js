// Node logger — mirrors the C++ chess::Logger format so all three services
// (cpp / node / client) produce structurally identical lines. Format:
//
//   [YYYY-MM-DD HH:MM:SS.mmm] [LEVEL] [file:line] [tag] message
//
// Runtime level from LOG_LEVEL env var (falls back to CHESS_LOG_LEVEL, then
// INFO). Any level below the threshold is a near-zero-cost early return.
//
// Usage:
//   const { log } = require("./logger");
//   log.info("io", `connect ${socket.id}`);
//   log.error("cpp", `request ${req.req_id} failed: ${err.message}`);

const LEVELS = Object.freeze({
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
});
const NAMES = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

function parseLevel(raw, fallback) {
  if (!raw) return fallback;
  const u = String(raw).trim().toUpperCase();
  const alias = { WARNING: "WARN", ERR: "ERROR", CRITICAL: "FATAL" };
  const key = alias[u] || u;
  return key in LEVELS ? LEVELS[key] : fallback;
}

let currentLevel = parseLevel(
  process.env.LOG_LEVEL || process.env.CHESS_LOG_LEVEL,
  LEVELS.INFO
);

// Pull "file:line" out of the caller's stack frame — the first frame that is
// neither inside this logger.js file nor a Node internal.
function callSite() {
  const stack = new Error().stack || "";
  const lines = stack.split("\n").slice(1); // drop the "Error" header
  for (const line of lines) {
    // Our own frames: /path/to/logger.js:LINE (require the separator so
    // "test-logger.js" isn't matched).
    if (/[\\/]logger\.js:\d+/.test(line)) continue;
    // Node internals: "at Module._compile (node:internal/…)".
    if (/\(node:internal|at\s+node:internal/.test(line)) continue;
    const m =
      line.match(/\(([^()]+):(\d+):\d+\)/) ||
      line.match(/at\s+([^\s()]+):(\d+):\d+/);
    if (m) {
      const path = m[1].split(/[\\/]/).pop();
      return `${path}:${m[2]}`;
    }
  }
  return "?:?";
}

function pad(s, n) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function tsNow() {
  // Local wall-clock, matches the C++ logger's put_time("%F %T") + ms.
  const d = new Date();
  const p2 = (x) => String(x).padStart(2, "0");
  const p3 = (x) => String(x).padStart(3, "0");
  return (
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ` +
    `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.` +
    p3(d.getMilliseconds())
  );
}

function stringifyArg(a) {
  if (a === null || a === undefined) return String(a);
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.stack || a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function emit(levelInt, tag, args) {
  if (levelInt < currentLevel) return;
  const message = args.map(stringifyArg).join(" ");
  const line = `[${tsNow()}] [${pad(NAMES[levelInt], 5)}] [${callSite()}] [${tag}] ${message}`;
  if (levelInt >= LEVELS.WARN) {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

const log = {
  trace: (tag, ...args) => emit(LEVELS.TRACE, tag, args),
  debug: (tag, ...args) => emit(LEVELS.DEBUG, tag, args),
  info:  (tag, ...args) => emit(LEVELS.INFO,  tag, args),
  warn:  (tag, ...args) => emit(LEVELS.WARN,  tag, args),
  error: (tag, ...args) => emit(LEVELS.ERROR, tag, args),
  fatal: (tag, ...args) => emit(LEVELS.FATAL, tag, args),

  setLevel(nameOrInt) {
    currentLevel =
      typeof nameOrInt === "number"
        ? Math.max(0, Math.min(5, nameOrInt | 0))
        : parseLevel(nameOrInt, currentLevel);
  },
  level: () => NAMES[currentLevel],
};

module.exports = { log, LEVELS };
