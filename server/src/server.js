// Chess socket relay server. No auth — anyone can create/join a room.
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { ID } = require("./utils");
const { roomMap, roomState } = require("./gameContext");
const NodeCppHandler = require("./nodeCppHandler");

const NODE_PORT = Number(process.env.PORT || process.env.NODE_PORT || 3000);
const NODE_HOST = process.env.NODE_HOST || "0.0.0.0";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim());

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS.length === 1 && ALLOWED_ORIGINS[0] === "*" ? "*" : ALLOWED_ORIGINS }));
app.use(express.json());

// Simple health endpoint — useful for docker healthchecks and VM probes.
app.get("/healthz", (_req, res) => res.json({ ok: true, service: "node-server" }));
app.get("/", (_req, res) =>
  res.json({ ok: true, message: "Chess node server. Connect via socket.io." })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const nodeCppHandler = new NodeCppHandler(io);

io.on("connection", (socket) => {
  console.log("[io] connect", socket.id);

  // Client asks: does this room exist and has capacity for me?
  socket.on("roomExistsCheck", (joinRoomId, cb) => {
    const room = io.sockets.adapter.rooms.get(joinRoomId);
    const numClients = room ? room.size : 0;
    const canJoin = numClients === 1;
    let joinerPlayerId = "";
    if (canJoin && roomState[joinRoomId]) {
      joinerPlayerId =
        roomState[joinRoomId].creatorId === ID.PLAYER1 ? ID.PLAYER2 : ID.PLAYER1;
    }
    cb(canJoin, joinerPlayerId);
  });

  socket.on("createRoom", (createRoomId, chosenPlayerId) => {
    socket.join(createRoomId);
    roomMap[socket.id] = createRoomId;
    roomState[createRoomId] = { creatorId: chosenPlayerId };
  });

  socket.on("joinRoom", (joinRoomId) => {
    socket.join(joinRoomId);
    roomMap[socket.id] = joinRoomId;
    nodeCppHandler.createRoomRequest(joinRoomId);
  });

  socket.on("chatText", (playerId, msg) => {
    const roomId = roomMap[socket.id];
    if (roomId) io.to(roomId).emit("serverChatText", playerId, msg);
  });

  socket.on("pieceFocus", (playerId, pieceId) => {
    const roomId = roomMap[socket.id];
    if (!roomId || !roomState[roomId]) return;
    if (playerId !== roomState[roomId].turn) return;
    nodeCppHandler.getValidMovesRequest(roomId, playerId, pieceId);
  });

  socket.on("pieceMove", (playerId, pieceId, oldPosition, newPosition) => {
    const roomId = roomMap[socket.id];
    if (!roomId || !roomState[roomId]) return;
    if (playerId !== roomState[roomId].turn) return;

    const stored = roomState[roomId]?.[playerId]?.moveMap?.[pieceId];
    if (!stored) return;
    const isValid = stored.some(
      (p) => JSON.stringify(p) === JSON.stringify(newPosition)
    );
    if (!isValid) return;

    nodeCppHandler.updatePositionRequest(roomId, playerId, pieceId, oldPosition, newPosition);
  });

  socket.on("checkOrMateStatus", (playerId) => {
    const roomId = roomMap[socket.id];
    if (roomId) nodeCppHandler.getCheckOrMateRequest(roomId, playerId);
  });

  socket.on("undo", (playerId) => {
    const roomId = roomMap[socket.id];
    if (roomId) nodeCppHandler.undoMoveRequest(roomId, playerId);
  });

  socket.on("redo", (playerId) => {
    const roomId = roomMap[socket.id];
    if (roomId) nodeCppHandler.redoMoveRequest(roomId, playerId);
  });

  socket.on("resign", (playerId) => {
    const roomId = roomMap[socket.id];
    if (roomId) nodeCppHandler.resignRequest(roomId, playerId);
  });

  socket.on("reset", (playerId) => {
    const roomId = roomMap[socket.id];
    if (roomId) nodeCppHandler.resetRequest(roomId, playerId);
  });

  socket.on("pawnPromotion", (playerId, pieceId, position, newPieceId) => {
    const roomId = roomMap[socket.id];
    if (roomId) {
      nodeCppHandler.pawnPromotionRequest(roomId, playerId, pieceId, position, newPieceId);
    }
  });

  socket.on("updateAlreadyPromotedPawnOf", (playerId, updatedAlreadyPromotedPawn) => {
    const roomId = roomMap[socket.id];
    if (roomId && roomState[roomId] && roomState[roomId][playerId]) {
      roomState[roomId][playerId].alreadyPromotedPawns = updatedAlreadyPromotedPawn;
    }
  });

  socket.on("getAlreadyPromotedPawnOf", (playerId, cb) => {
    const roomId = roomMap[socket.id];
    if (roomId && roomState[roomId] && roomState[roomId][playerId]) {
      cb(roomState[roomId][playerId].alreadyPromotedPawns || []);
    } else {
      cb([]);
    }
  });

  socket.on("disconnect", () => {
    const roomId = roomMap[socket.id];
    delete roomMap[socket.id];
    if (roomId) {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room || room.size === 0) delete roomState[roomId];
    }
    console.log("[io] disconnect", socket.id);
  });
});

server.listen(NODE_PORT, NODE_HOST, () =>
  console.log(`chess-server listening on http://${NODE_HOST}:${NODE_PORT} (cpp: ${process.env.CPP_HOST || "localhost"}:${process.env.CPP_PORT || "5000"})`)
);
