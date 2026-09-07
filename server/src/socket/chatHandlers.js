const { SOCKET_EVENT, MAX_CHAT_LENGTH } = require("../constants");
const { log } = require("../logger");

/**
 * Chat is a straight broadcast to the room. Text is clipped to
 * MAX_CHAT_LENGTH characters as defence-in-depth against a rogue client
 * flooding the peer.
 */
function attachChatHandlers(socket, { io, rooms }) {
  socket.on(SOCKET_EVENT.CHAT_TEXT, (playerId, msg) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId) return;
    if (typeof msg !== "string" || msg.length === 0) return;

    const clipped = msg.slice(0, MAX_CHAT_LENGTH);
    io.to(roomId).emit(SOCKET_EVENT.SERVER_CHAT_TEXT, playerId, clipped);
    log.debug("chat", `room=${roomId} from=${playerId} chars=${clipped.length}`);
  });
}

module.exports = { attachChatHandlers };
