// Chess socket relay — no auth, anyone can create/join a room.
//
// Boot flow:
//   1. Parse config (config.js).
//   2. Stand up express + socket.io on the same http.Server.
//   3. Wire the three long-lived collaborators: RoomRegistry, CppClient,
//      GameEngine. These have no global singletons — everything is passed
//      down explicitly.
//   4. On every incoming socket, attach the handler modules from ./socket/.
//   5. Register a graceful shutdown that closes the io + http servers on
//      SIGTERM / SIGINT (Railway sends SIGTERM on redeploy).

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server: IoServer } = require("socket.io");

const config = require("./config");
const { log } = require("./logger");
const { RoomRegistry } = require("./state/RoomRegistry");
const { CppClient } = require("./cpp/CppClient");
const { GameEngine } = require("./cpp/GameEngine");
const { attachSocketHandlers } = require("./socket/attach");

// ---------- HTTP + Socket.IO scaffolding ----------

function createHttpApp(rooms) {
  const app = express();
  app.use(cors({
    origin:
      config.ALLOWED_ORIGINS.length === 1 && config.ALLOWED_ORIGINS[0] === "*"
        ? "*"
        : config.ALLOWED_ORIGINS,
  }));
  app.use(express.json());

  // Cheap probe for docker/Railway healthchecks.
  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "node-relay" }));

  // Optional visibility endpoint. Never exposes any player data, just counts.
  app.get("/stats", (_req, res) =>
    res.json({
      ok: true,
      rooms: rooms.size(),
      uptimeSec: Math.round(process.uptime()),
    })
  );

  app.get("/", (_req, res) =>
    res.json({ ok: true, message: "Chess node server. Connect via socket.io." })
  );

  return app;
}

function createIo(httpServer) {
  return new IoServer(httpServer, {
    path: config.SOCKET_IO_PATH,
    cors: { origin: "*", methods: ["GET", "POST"] },
  });
}

// ---------- boot ----------

function main() {
  const rooms = new RoomRegistry();
  const cppClient = new CppClient({
    host: config.CPP_HOST,
    port: config.CPP_PORT,
    timeoutMs: config.CPP_REQUEST_TIMEOUT_MS,
  });

  const app = createHttpApp(rooms);
  const httpServer = http.createServer(app);
  const io = createIo(httpServer);

  const engine = new GameEngine({ io, rooms, cppClient });
  const deps = { io, rooms, engine };

  io.on("connection", (socket) => {
    log.debug("io", `connect ${socket.id}`);
    attachSocketHandlers(socket, deps);
  });

  httpServer.listen(config.PORT, config.HOST, () => {
    log.info(
      "server",
      `listening on http://${config.HOST}:${config.PORT} ` +
        `(socket.io path: ${config.SOCKET_IO_PATH}, ` +
        `cpp: ${config.CPP_HOST}:${config.CPP_PORT}, log level=${log.level()})`
    );
  });

  installShutdownHandlers({ io, httpServer });
}

function installShutdownHandlers({ io, httpServer }) {
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    log.info("server", `${signal} received — draining connections`);
    io.close(() => log.debug("server", "socket.io closed"));
    httpServer.close((err) => {
      if (err) log.error("server", `http close error: ${err.message}`);
      else log.info("server", "http server closed cleanly");
      process.exit(err ? 1 : 0);
    });
    // Belt-and-braces: force exit if a stray keep-alive won't let go.
    setTimeout(() => {
      log.warn("server", "forced exit after 10s drain timeout");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    log.error("server", `uncaughtException: ${err?.stack || err}`);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("server", `unhandledRejection: ${reason?.stack || reason}`);
  });
}

main();
