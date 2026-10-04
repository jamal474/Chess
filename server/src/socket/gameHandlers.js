const { PLAYER, SOCKET_EVENT, UNDO_REQUEST_TIMEOUT_MS } = require("../constants");
const config = require("../config");
const { log } = require("../logger");

const other = (p) => (p === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1);

/**
 * All in-game events: piece move, the undo request / answer, the commands
 * (redo, resign, reset) and two legacy requests (pieceFocus, checkOrMateStatus) that the
 * relay now answers by pushing legalMoves / check events itself.
 *
 * A move is only forwarded to the engine if it's the player's turn and the
 * target is among the legal moves the engine sent for this turn; the engine
 * then checks it again itself.
 */
function attachGameHandlers(socket, { io, rooms, engine }) {
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
    if (rooms.isPaused(roomId)) {
      log.debug(tag, `room=${roomId} is paused (a seat is empty)`);
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

    // A move ends any undo request still waiting for an answer.
    if (rooms.clearPendingUndo(roomId)) sendUndoState(roomId, { type: "cancelled", by: other(playerId) });

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
  // Ignored while the game is paused for an empty seat.
  const forRoom = (fn) => (playerId) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (roomId && !rooms.isPaused(roomId)) fn(roomId, playerId);
  };
  socket.on(SOCKET_EVENT.REDO,   forRoom((r, p) => { log.info("game.redo",   `room=${r} by=${p}`); engine.redo(r, p); }));
  socket.on(SOCKET_EVENT.RESIGN, forRoom((r, p) => {
    log.info("game.resign", `room=${r} by=${p}`);
    if (rooms.clearPendingUndo(r)) sendUndoState(r);
    engine.resign(r, p);
  }));
  socket.on(SOCKET_EVENT.RESET,  forRoom(async (r, p) => {
    log.info("game.reset",  `room=${r} by=${p}`);
    await engine.reset(r, p); // startGame() zeroes the undo counts
    sendUndoState(r);
  }));

  // ---------- Undo: request → opponent allows / declines ----------
  //
  // The engine only lets the player who made the last move take it back, so a
  // request is only valid while it's the opponent's turn. Each player gets
  // MAX_UNDOS per game; an accepted request uses one, a declined one doesn't.

  function sendUndoState(roomId, event) {
    const state = rooms.undoState(roomId);
    if (state) io.to(roomId).emit(SOCKET_EVENT.SERVER_UNDO_STATE, state, event ?? null);
  }

  socket.on(SOCKET_EVENT.UNDO_REQUEST, forRoom((roomId, by) => {
    const reject = (why) => log.debug("game.undoRequest", `room=${roomId} by=${by} rejected: ${why}`);
    if (by !== PLAYER.PLAYER1 && by !== PLAYER.PLAYER2) return reject("bad player");
    if (rooms.currentTurn(roomId) !== other(by)) return reject("not right after your move");
    if (rooms.pendingUndo(roomId)) return reject("a request is already pending");
    if (rooms.undosLeft(roomId, by) <= 0) return reject("no undos left");

    const expiresAt = Date.now() + UNDO_REQUEST_TIMEOUT_MS;
    const timer = setTimeout(() => {
      const pending = rooms.pendingUndo(roomId);
      if (!pending || pending.expiresAt !== expiresAt) return;
      rooms.clearPendingUndo(roomId);
      log.info("game.undo", `room=${roomId} request by=${by} expired`);
      sendUndoState(roomId, { type: "expired", by });
    }, UNDO_REQUEST_TIMEOUT_MS);
    timer.unref?.();
    rooms.setPendingUndo(roomId, by, expiresAt, timer);
    log.info("game.undo", `room=${roomId} requested by=${by}`);
    sendUndoState(roomId, { type: "requested", by });
  }));

  socket.on(SOCKET_EVENT.UNDO_CANCEL, forRoom((roomId, by) => {
    const pending = rooms.pendingUndo(roomId);
    if (!pending || pending.by !== by) return;
    rooms.clearPendingUndo(roomId);
    log.info("game.undo", `room=${roomId} request by=${by} cancelled`);
    sendUndoState(roomId, { type: "cancelled", by });
  }));

  socket.on(SOCKET_EVENT.UNDO_RESPOND, async (responder, accept) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId) return;
    const pending = rooms.pendingUndo(roomId);
    if (!pending || other(pending.by) !== responder || rooms.isPaused(roomId)) return;
    const by = pending.by;
    rooms.clearPendingUndo(roomId);

    if (accept !== true) {
      log.info("game.undo", `room=${roomId} request by=${by} declined`);
      return sendUndoState(roomId, { type: "declined", by });
    }
    const ok = await engine.undo(roomId, by);
    if (ok) rooms.countUndo(roomId, by);
    log.info("game.undo", `room=${roomId} request by=${by} ${ok ? "accepted" : "accepted, engine refused"}`);
    sendUndoState(roomId, { type: ok ? "accepted" : "failed", by });
  });

  // Dev tools only: the old immediate undo, used by hot-seat play from one tab.
  // It still counts against the cap.
  if (config.DEV_TOOLS) {
    socket.on(SOCKET_EVENT.UNDO, forRoom(async (r, p) => {
      if (rooms.undosLeft(r, p) <= 0) return;
      log.info("game.undo", `room=${r} by=${p} (dev, immediate)`);
      if (await engine.undo(r, p)) rooms.countUndo(r, p);
      sendUndoState(r, { type: "accepted", by: p });
    }));
  }
}

function isPosition(v) {
  return v && typeof v === "object" && Number.isInteger(v.x) && Number.isInteger(v.y);
}

module.exports = { attachGameHandlers };
