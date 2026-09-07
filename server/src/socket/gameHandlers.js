const { SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");

/**
 * All in-game events — piece focus, piece move, check/mate polling, and
 * the four "commands" (undo, redo, resign, reset).
 * Every handler is guarded so a client can't cheat by moving out of turn
 * or targeting a square the engine never approved.
 */
function attachGameHandlers(socket, { rooms, engine }) {
  /**
   * Confirms this socket is in a live room and it's the given player's turn.
   * Returns the roomId on success, null on rejection. All rejections log at
   * DEBUG so the reason is visible when tracing.
   */
  const guardTurn = (playerId, tag) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId || !rooms.has(roomId)) {
      log.debug(tag, `no active room for socket=${socket.id}`);
      return null;
    }
    const turn = rooms.currentTurn(roomId);
    if (turn !== playerId) {
      log.debug(tag, `not ${playerId}'s turn (turn=${turn}) room=${roomId}`);
      return null;
    }
    return roomId;
  };

  socket.on(SOCKET_EVENT.PIECE_FOCUS, (playerId, pieceId) => {
    const roomId = guardTurn(playerId, "game.pieceFocus");
    if (!roomId) return;
    engine.getValidMoves(roomId, playerId, pieceId);
  });

  socket.on(SOCKET_EVENT.PIECE_MOVE, (playerId, pieceId, oldPos, newPos) => {
    const roomId = guardTurn(playerId, "game.pieceMove");
    if (!roomId) return;

    // Only a target the engine has previously green-lit for this piece is
    // allowed. Skips the round-trip and prevents a malformed client from
    // teleporting pieces.
    const stored = rooms.storedValidMoves(roomId, playerId, pieceId);
    if (!Array.isArray(stored) || stored.length === 0) {
      log.debug("game.pieceMove", `no stored moves for piece=${pieceId} — pieceFocus first`);
      return;
    }
    if (!isPosition(newPos)) return log.warn("game.pieceMove", `bad newPos=${JSON.stringify(newPos)}`);

    const ok = stored.some((p) => p && p.x === newPos.x && p.y === newPos.y);
    if (!ok) {
      log.debug("game.pieceMove", `invalid target room=${roomId} piece=${pieceId} → ${JSON.stringify(newPos)}`);
      return;
    }

    log.debug("game.pieceMove", `${playerId} ${pieceId} → ${newPos.x}${newPos.y} in ${roomId}`);
    engine.updatePosition(roomId, playerId, pieceId, oldPos, newPos);
  });

  socket.on(SOCKET_EVENT.CHECK_OR_MATE_STATUS, (playerId) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (roomId) engine.getCheckOrMate(roomId, playerId);
  });

  // Command handlers — small enough to inline. Each one is a no-op when
  // there's no active room; safe to fire during teardown.
  const forRoom = (fn) => (playerId) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (roomId) fn(roomId, playerId);
  };
  socket.on(SOCKET_EVENT.UNDO,   forRoom((r, p) => { log.info("game.undo",   `room=${r} by=${p}`); engine.undo(r, p); }));
  socket.on(SOCKET_EVENT.REDO,   forRoom((r, p) => { log.info("game.redo",   `room=${r} by=${p}`); engine.redo(r, p); }));
  socket.on(SOCKET_EVENT.RESIGN, forRoom((r, p) => { log.info("game.resign", `room=${r} by=${p}`); engine.resign(r, p); }));
  socket.on(SOCKET_EVENT.RESET,  forRoom((r, p) => { log.info("game.reset",  `room=${r} by=${p}`); engine.reset(r, p); }));
}

function isPosition(v) {
  return v && typeof v === "object" && Number.isInteger(v.x) && Number.isInteger(v.y);
}

module.exports = { attachGameHandlers };
