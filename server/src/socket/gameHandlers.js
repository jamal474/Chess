const { SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");

/**
 * All in-game events: piece move, the four commands (undo, redo, resign,
 * reset) and two legacy requests (pieceFocus, checkOrMateStatus) that the
 * relay now answers by pushing legalMoves / check events itself.
 *
 * A move is only forwarded to the engine if it's the player's turn and the
 * target is among the legal moves the engine sent for this turn; the engine
 * then checks it again itself.
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

  // Legacy: browsers now highlight from the pushed legalMoves. Answered from
  // the cache, no engine call.
  socket.on(SOCKET_EVENT.PIECE_FOCUS, (playerId, pieceId) => {
    const roomId = guardTurn(playerId, "game.pieceFocus");
    if (roomId) engine.validMoves(roomId, playerId, pieceId);
  });

  // pieceMove(playerId, pieceId, oldPos, newPos, [options], [ack])
  //   options: { promotion: "queen" | "rook" | "bishop" | "knight" }
  //   ack({ ok, error? }) lets the browser roll back an optimistic move.
  socket.on(SOCKET_EVENT.PIECE_MOVE, async (playerId, pieceId, _oldPos, newPos, ...rest) => {
    const ack = typeof rest.at(-1) === "function" ? rest.pop() : () => {};
    const options = rest[0] && typeof rest[0] === "object" ? rest[0] : {};
    const reject = (error) => ack({ ok: false, error });

    const roomId = guardTurn(playerId, "game.pieceMove");
    if (!roomId) return reject("not your turn");
    if (!isPosition(newPos)) {
      log.warn("game.pieceMove", `bad newPos=${JSON.stringify(newPos)}`);
      return reject("bad position");
    }
    const legal = rooms.storedValidMoves(roomId, playerId, pieceId);
    if (!Array.isArray(legal) || !legal.some((p) => p && p.x === newPos.x && p.y === newPos.y)) {
      log.debug("game.pieceMove", `illegal target room=${roomId} piece=${pieceId} → ${JSON.stringify(newPos)}`);
      return reject("illegal move");
    }

    log.debug("game.pieceMove", `${playerId} ${pieceId} → ${newPos.x}${newPos.y} in ${roomId}`);
    ack(await engine.move(roomId, playerId, pieceId, newPos, { promotion: options.promotion }));
  });

  // Legacy: check status is pushed after every move now.
  socket.on(SOCKET_EVENT.CHECK_OR_MATE_STATUS, () => {
    const roomId = rooms.roomIdFor(socket.id);
    if (roomId && rooms.currentTurn(roomId)) engine.refreshTurn(roomId);
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
