const { EventEmitter } = require("events");
const { PLAYER, CPP_REQ, SOCKET_EVENT, STATUS, MATE_STATUS } = require("../constants");
const { log } = require("../logger");

const other = (p) => (p === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1);

/**
 * Game logic between the sockets and the C++ engine.
 *
 * Every state-changing operation is one engine request whose response
 * carries the next player's `turn_state` (check/mate status and all of their
 * legal moves). The relay then pushes everything the browsers need:
 *
 *   serverPieceMove → serverPawnPromotion? → changeTurn → legalMoves → check|checkMate|staleMate?
 *
 * so the browser never has to ask "which squares?" or "am I in check?".
 *
 * Operations on one room run one at a time (see _serial), so two quick
 * requests can't interleave against the engine.
 *
 * Also emits domain events after each successful operation — started,
 * moved, undone, redone, promoted, reset — each with { roomId, … }. Nothing
 * in production listens; the dev tools use them to record history.
 */
class GameEngine extends EventEmitter {
  constructor({ io, rooms, cppClient }) {
    super();
    this.io = io;
    this.rooms = rooms;
    this.cpp = cppClient;
    /** @type {Map<string, Promise<unknown>>} tail of each room's operation queue */
    this._queues = new Map();
  }

  // ==================== operations ====================

  /** Second player joined (or a dev solo game): set up the board. Resolves true on success. */
  createRoom(roomId) {
    return this._serial(roomId, async () => {
      const res = await this._request({ req_id: CPP_REQ.CREATE_ROOM, room_id: roomId });
      if (!res) return false;
      this.rooms.startGame(roomId);
      log.info("engine.createRoom", `game started in room=${roomId}`);
      this._toRoom(roomId, SOCKET_EVENT.START_GAME);
      this.emit("started", { roomId });
      this._applyTurnState(roomId, res.turn_state);
      return true;
    });
  }

  /** Last socket left: free the engine's board. Fire and forget. */
  deleteRoom(roomId) {
    this._serial(roomId, () => this._request({ req_id: CPP_REQ.DELETE_ROOM, room_id: roomId }, { quiet: true }))
      .finally(() => this._queues.delete(roomId));
  }

  /**
   * Plays a move the relay has already checked against the cached legal moves.
   * Resolves { ok, error? }.
   */
  move(roomId, playerId, pieceId, to, { promotion } = {}) {
    // Nothing else may move for this player until the engine has answered.
    this.rooms.clearLegalMoves(roomId);
    return this._serial(roomId, async () => {
      const res = await this._request({
        req_id: CPP_REQ.UPDATE_POSITION,
        room_id: roomId, player_id: playerId, piece_id: pieceId,
        position: to, ...(promotion ? { promotion } : {}),
      });
      if (!res) {
        // Rejected: give the player their legal moves back.
        await this._refreshTurnUnqueued(roomId);
        return { ok: false, error: "move rejected" };
      }

      this._toRoom(roomId, SOCKET_EVENT.SERVER_PIECE_MOVE, playerId, pieceId, res.old_position, res.position);
      this.rooms.recordMove(roomId, { player: playerId, pieceId, from: res.old_position, to: res.position });
      this.emit("moved", { roomId, playerId, pieceId, from: res.old_position, to: res.position });

      if (res.promoted_to) {
        const list = this.rooms.getAlreadyPromoted(roomId, playerId);
        this.rooms.setAlreadyPromoted(roomId, playerId, [...list, pieceId]);
        this._toRoom(roomId, SOCKET_EVENT.SERVER_PAWN_PROMOTION, playerId, pieceId, res.position, res.promoted_to);
        this.rooms.recordPromotion(roomId, res.promoted_to);
        this.emit("promoted", { roomId, playerId, pieceId, newPieceId: res.promoted_to });
      }

      this._applyTurnState(roomId, res.turn_state);
      return { ok: true };
    });
  }

  /** Takes back playerId's last move. Resolves true if the engine did it. */
  undo(roomId, playerId) {
    return this._serial(roomId, async () => {
      const res = await this._request({ req_id: CPP_REQ.UNDO_MOVE, room_id: roomId, player_id: playerId });
      if (!res) return false;
      this._toRoom(
        roomId, SOCKET_EVENT.SERVER_UNDO,
        res.player_id, res.piece_id, res.position, res.is_demoted,
        res.revived_player_id, res.revived_piece_id, res.revived_position,
      );
      this.rooms.recordUndo(roomId);
      this.emit("undone", { roomId });
      this._applyTurnState(roomId, res.turn_state);
      return true;
    });
  }

  redo(roomId, playerId) {
    return this._serial(roomId, async () => {
      const res = await this._request({ req_id: CPP_REQ.REDO_MOVE, room_id: roomId, player_id: playerId });
      if (!res) return;
      this._toRoom(
        roomId, SOCKET_EVENT.SERVER_REDO,
        res.player_id, res.piece_id, res.position, res.pawn_promoted,
        res.killed_player_id, res.killed_piece_id, res.killed_position,
      );
      this.rooms.recordRedo(roomId);
      this.emit("redone", { roomId });
      this._applyTurnState(roomId, res.turn_state);
    });
  }

  resign(roomId, playerId) {
    return this._serial(roomId, async () => {
      const res = await this._request({ req_id: CPP_REQ.RESIGN, room_id: roomId, player_id: playerId });
      if (!res) return;
      log.info("engine.resign", `room=${roomId} player=${playerId}`);
      this.rooms.clearLegalMoves(roomId);
      this.rooms.setOver(roomId);
      this._toRoom(roomId, SOCKET_EVENT.SERVER_RESIGN, playerId);
    });
  }

  reset(roomId, playerId) {
    return this._serial(roomId, async () => {
      const res = await this._request({ req_id: CPP_REQ.RESET, room_id: roomId, player_id: playerId });
      if (!res) return;
      this.rooms.startGame(roomId);
      log.info("engine.reset", `room=${roomId}`);
      this._toRoom(roomId, SOCKET_EVENT.SERVER_RESET, playerId);
      this.emit("reset", { roomId });
      this._applyTurnState(roomId, res.turn_state);
    });
  }

  /**
   * Re-sends legal moves and check status for whoever is to move. Used by the
   * legacy checkOrMateStatus event and by the dev tools after loading a game.
   */
  refreshTurn(roomId) {
    return this._serial(roomId, () => this._refreshTurnUnqueued(roomId));
  }

  /** Legacy pieceFocus: answered from the legal moves cached for this turn. */
  validMoves(roomId, playerId, pieceId) {
    const cached = this.rooms.storedValidMoves(roomId, playerId, pieceId);
    this._toRoom(roomId, SOCKET_EVENT.SERVER_PIECE_FOCUS, playerId, cached || []);
  }

  // ==================== internals ====================

  async _refreshTurnUnqueued(roomId) {
    const turn = this.rooms.currentTurn(roomId);
    if (!turn) return;
    const res = await this._request({ req_id: CPP_REQ.TURN_STATE, room_id: roomId, player_id: turn });
    if (res) this._applyTurnState(roomId, res.turn_state);
  }

  /**
   * Records whose turn it is and their legal moves, then tells the room:
   * changeTurn, legalMoves and, if relevant, check / checkMate / staleMate.
   */
  _applyTurnState(roomId, state) {
    if (!state || !state.player_id) return;
    const player = state.player_id;
    const changed = this.rooms.currentTurn(roomId) !== player;
    this.rooms.setTurn(roomId, player);
    this.rooms.clearLegalMoves(roomId);
    this.rooms.setLegalMoves(roomId, player, state.legal_moves || {});

    if (changed) this._toRoom(roomId, SOCKET_EVENT.CHANGE_TURN, player);
    this._toRoom(roomId, SOCKET_EVENT.LEGAL_MOVES, player, state.legal_moves || {});

    switch (state.check_or_mate_status) {
      case MATE_STATUS.CHECK:      return this._toRoom(roomId, SOCKET_EVENT.CHECK, player);
      case MATE_STATUS.CHECK_MATE:
        this.rooms.setOver(roomId);
        return this._toRoom(roomId, SOCKET_EVENT.CHECK_MATE, player);
      case MATE_STATUS.STALE_MATE:
        this.rooms.setOver(roomId);
        return this._toRoom(roomId, SOCKET_EVENT.STALE_MATE, player);
      case MATE_STATUS.NIL:        return undefined;
      default: log.warn("engine", `unknown check_or_mate_status=${state.check_or_mate_status}`);
    }
  }

  /** Sends a request; resolves the response, or null on failure (already logged). */
  async _request(payload, { quiet = false } = {}) {
    try {
      const res = await this.cpp.send(payload);
      if (res?.status === STATUS.SUCCESSFUL) return res;
      if (!quiet) {
        log.warn(`engine.${payload.req_id}`, `status=${res?.status} room=${payload.room_id}${res?.error ? ` (${res.error})` : ""}`);
      }
      return null;
    } catch (_err) {
      return null; // CppClient logged the transport failure
    }
  }

  /** Runs fn after every earlier operation on the same room has finished. */
  _serial(roomId, fn) {
    const prev = this._queues.get(roomId) || Promise.resolve();
    const next = prev.then(fn, fn);
    this._queues.set(roomId, next.catch(() => {}));
    return next;
  }

  _toRoom(roomId, event, ...args) {
    this.io.to(roomId).emit(event, ...args);
  }
}

module.exports = { GameEngine, other };
