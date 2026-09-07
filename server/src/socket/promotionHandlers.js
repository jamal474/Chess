const { SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");

/**
 * Pawn promotion has three events:
 *   * pawnPromotion — client asks the engine to promote a pawn.
 *   * updateAlreadyPromotedPawnOf / getAlreadyPromotedPawnOf — the client
 *     mirrors the "who's already been auto-promoted?" list on the server
 *     side so undo/redo can restore it correctly.
 */
function attachPromotionHandlers(socket, { rooms, engine }) {
  socket.on(SOCKET_EVENT.PAWN_PROMOTION, (playerId, pieceId, position, newPieceId) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId) return;
    log.debug("promotion", `promote ${playerId} ${pieceId} → ${newPieceId} in room=${roomId}`);
    engine.pawnPromotion(roomId, playerId, pieceId, position, newPieceId);
  });

  socket.on(SOCKET_EVENT.UPDATE_ALREADY_PROMOTED_PAWN_OF, (playerId, list) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId) return;
    rooms.setAlreadyPromoted(roomId, playerId, list);
    log.trace("promotion", `set list room=${roomId} player=${playerId} list=${JSON.stringify(list)}`);
  });

  socket.on(SOCKET_EVENT.GET_ALREADY_PROMOTED_PAWN_OF, (playerId, cb) => {
    if (typeof cb !== "function") return;
    const roomId = rooms.roomIdFor(socket.id);
    cb(roomId ? rooms.getAlreadyPromoted(roomId, playerId) : []);
  });
}

module.exports = { attachPromotionHandlers };
