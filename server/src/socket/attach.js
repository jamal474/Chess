const { log } = require("../logger");
const { attachRoomHandlers }      = require("./roomHandlers");
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

function attachLifecycleHandlers(socket, { io, rooms }) {
  socket.on("disconnect", (reason) => {
    const roomId = rooms.unbindSocket(socket.id);
    let empty = false;
    if (roomId) {
      // socket.io removes the socket from its rooms *before* firing this
      // event, so adapter.rooms is already up-to-date.
      const remaining = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
      if (remaining === 0) {
        rooms.dispose(roomId);
        empty = true;
      }
    }
    log.debug(
      "io",
      `disconnect ${socket.id} reason=${reason ?? "?"}` +
        (roomId ? ` room=${roomId}${empty ? " (last, disposed)" : ""}` : "")
    );
  });

  socket.on("error", (err) => {
    log.error("io", `socket=${socket.id} error: ${err?.message || err}`);
  });
}

module.exports = { attachSocketHandlers };
