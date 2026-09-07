const { PLAYER, SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");

/**
 * Room lifecycle over socket.io:
 *   * roomExistsCheck — the join dialog on the menu page asks whether a code
 *     is joinable and which seat it'd take.
 *   * createRoom      — one player claims a code and picks a colour.
 *   * joinRoom        — the second player joins → kicks the engine into
 *                       initialising the board → engine broadcasts startGame.
 */
function attachRoomHandlers(socket, { io, rooms, engine }) {
  socket.on(SOCKET_EVENT.ROOM_EXISTS_CHECK, (roomId, cb) => {
    const respond = (canJoin, joinerPlayerId) =>
      typeof cb === "function" && cb(canJoin, joinerPlayerId || "");
    try {
      if (!isValidRoomId(roomId)) return respond(false, "");
      const numClients = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
      const canJoin = numClients === 1 && rooms.has(roomId);
      const joinerPlayerId = canJoin ? rooms.otherPlayerId(roomId) : "";
      log.debug("room.exists", `room=${roomId} canJoin=${canJoin} occupants=${numClients}`);
      respond(canJoin, joinerPlayerId);
    } catch (err) {
      log.error("room.exists", `error for room=${roomId}: ${err.message}`);
      respond(false, "");
    }
  });

  socket.on(SOCKET_EVENT.CREATE_ROOM, (roomId, chosenPlayerId) => {
    if (!isValidRoomId(roomId)) return log.warn("room.create", `bad roomId=${JSON.stringify(roomId)}`);
    if (!isValidPlayerId(chosenPlayerId))
      return log.warn("room.create", `bad chosenPlayerId=${JSON.stringify(chosenPlayerId)}`);
    if (rooms.has(roomId)) return log.warn("room.create", `duplicate roomId=${roomId}`);

    socket.join(roomId);
    rooms.create(roomId, chosenPlayerId);
    rooms.bindSocket(socket.id, roomId);
    log.info("room.create", `socket=${socket.id} created room=${roomId} as ${chosenPlayerId} (rooms=${rooms.size()})`);
  });

  socket.on(SOCKET_EVENT.JOIN_ROOM, (roomId) => {
    if (!isValidRoomId(roomId)) return log.warn("room.join", `bad roomId=${JSON.stringify(roomId)}`);
    if (!rooms.has(roomId)) return log.warn("room.join", `room=${roomId} does not exist`);
    const occupants = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
    if (occupants >= 2) return log.warn("room.join", `room=${roomId} already full (${occupants})`);

    socket.join(roomId);
    rooms.bindSocket(socket.id, roomId);
    log.info("room.join", `socket=${socket.id} joined room=${roomId}`);

    // Kick the engine off — its response will fire `startGame` on both sockets.
    engine.createRoom(roomId);
  });
}

function isValidRoomId(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}
function isValidPlayerId(v) {
  return v === PLAYER.PLAYER1 || v === PLAYER.PLAYER2;
}

module.exports = { attachRoomHandlers };
