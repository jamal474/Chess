const { log } = require("../logger");
const { attachRoomHandlers, leaveRoom } = require("./roomHandlers");
const { attachGameHandlers }      = require("./gameHandlers");
const { attachChatHandlers }      = require("./chatHandlers");
const { attachPromotionHandlers } = require("./promotionHandlers");

/**
 * Composition root for one socket. Ordering doesn't matter for
 * correctness, but grouping keeps the boot order easy to eyeball.
 */
function attachSocketHandlers(socket, deps) {
  attachRoomHandlers(socket, deps);
  attachGameHandlers(socket, deps);
  attachChatHandlers(socket, deps);
  attachPromotionHandlers(socket, deps);
  attachLifecycleHandlers(socket, deps);
}

function attachLifecycleHandlers(socket, deps) {
  socket.on("disconnect", (reason) => {
    // Same as leaving the page: the room is disposed if it's now empty,
    // otherwise the other player is told and the game pauses.
    const roomId = leaveRoom(socket, deps);
    log.debug("io", `disconnect ${socket.id} reason=${reason ?? "?"}${roomId ? ` room=${roomId}` : ""}`);
  });

  socket.on("error", (err) => {
    log.error("io", `socket=${socket.id} error: ${err?.message || err}`);
  });
}

module.exports = { attachSocketHandlers };
