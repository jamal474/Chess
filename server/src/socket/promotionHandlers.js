const { SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");

/**
 * Pawn promotion now happens inside the move itself: the engine promotes a
 * pawn that reaches the last rank (to a queen, or to options.promotion on
 * pieceMove) and the relay broadcasts serverPawnPromotion with the move.
 *
 * These handlers remain only so a browser still running an older bundle
 * doesn't break: the promote request is ignored (the pawn is already
 * promoted) and the "already promoted" list is served from the relay's own
 * record.
 */
function attachPromotionHandlers(socket, { rooms }) {
  socket.on(SOCKET_EVENT.PAWN_PROMOTION, (playerId, pieceId) => {
    log.debug("promotion", `ignoring legacy pawnPromotion ${playerId} ${pieceId}; the engine promotes on the move`);
  });

  socket.on(SOCKET_EVENT.UPDATE_ALREADY_PROMOTED_PAWN_OF, () => {});

  socket.on(SOCKET_EVENT.GET_ALREADY_PROMOTED_PAWN_OF, (playerId, cb) => {
    if (typeof cb !== "function") return;
    const roomId = rooms.roomIdFor(socket.id);
    cb(roomId ? rooms.getAlreadyPromoted(roomId, playerId) : []);
  });
}

module.exports = { attachPromotionHandlers };
