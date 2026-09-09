// Central configuration. Reads env vars once at boot and freezes the result
// so no other module needs to touch process.env. Anything a runtime knob
// influences should be threaded through this object.

require("dotenv").config();

function num(name, fallback) {
  const raw = process.env[name];
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const config = Object.freeze({
  // HTTP / socket.io bind
  PORT: num("PORT", num("NODE_PORT", 3000)),
  HOST: process.env.NODE_HOST || "0.0.0.0",

  // C++ engine
  CPP_HOST: process.env.CPP_HOST || "localhost",
  CPP_PORT: num("CPP_PORT", 5000),
  CPP_REQUEST_TIMEOUT_MS: num("CPP_REQUEST_TIMEOUT_MS", 5000),

  // socket.io endpoint path. Must match what the browser asks for. The client
  // is mounted at a sub-path (/chess/) and nginx forwards that URI through
  // unchanged, so in deployment this is "/chess/socket.io/"; the default keeps
  // a bare `npm run dev` relay answering on its own root.
  SOCKET_IO_PATH: process.env.SOCKET_IO_PATH || "/socket.io/",

  // CORS
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Logger already reads LOG_LEVEL / CHESS_LOG_LEVEL itself; exposed here only
  // for the boot line.
  LOG_LEVEL: process.env.LOG_LEVEL || process.env.CHESS_LOG_LEVEL || "INFO",
});

module.exports = config;
