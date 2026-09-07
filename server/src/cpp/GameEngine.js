const {
  PLAYER, CPP_REQ, SOCKET_EVENT, STATUS, MATE_STATUS,
} = require("../constants");
const { log } = require("../logger");

/**
 * Façade over the C++ engine.
 *   * public request…() methods build a payload and dispatch it.
 *   * private _on…() handlers translate engine responses into socket
 *     broadcasts + room-registry updates.
 *
 * Nothing else in the codebase talks HTTP to the engine; that boundary is
 * held here so wire changes stay local.
 */
class GameEngine {
  constructor({ io, rooms, cppClient }) {
    this.io = io;
    this.rooms = rooms;
    this.cpp = cppClient;
  }

  // ==================== outbound requests ====================

  createRoom(roomId) {
    return this._send({ req_id: CPP_REQ.CREATE_ROOM, room_id: roomId });
  }
  getValidMoves(roomId, playerId, pieceId) {
    return this._send({
      req_id: CPP_REQ.VALID_MOVES,
      room_id: roomId, player_id: playerId, piece_id: pieceId,
    });
  }
  updatePosition(roomId, playerId, pieceId, oldPos, newPos) {
    return this._send({
      req_id: CPP_REQ.UPDATE_POSITION,
      room_id: roomId, player_id: playerId, piece_id: pieceId,
      old_position: oldPos, position: newPos,
    });
  }
  getCheckOrMate(roomId, playerId) {
    return this._send({
      req_id: CPP_REQ.CHECK_OR_MATE,
      room_id: roomId, player_id: playerId,
    });
  }
  undo(roomId, playerId)   { return this._send({ req_id: CPP_REQ.UNDO_MOVE, room_id: roomId, player_id: playerId }); }
  redo(roomId, playerId)   { return this._send({ req_id: CPP_REQ.REDO_MOVE, room_id: roomId, player_id: playerId }); }
  resign(roomId, playerId) { return this._send({ req_id: CPP_REQ.RESIGN,    room_id: roomId, player_id: playerId }); }
  reset(roomId, playerId)  { return this._send({ req_id: CPP_REQ.RESET,     room_id: roomId, player_id: playerId }); }
  pawnPromotion(roomId, playerId, pieceId, position, newPieceId) {
    return this._send({
      req_id: CPP_REQ.PAWN_PROMOTION,
      room_id: roomId, player_id: playerId, piece_id: pieceId,
      position, new_piece_id: newPieceId,
    });
  }

  async _send(payload) {
    try {
      const res = await this.cpp.send(payload);
      if (res) this._dispatch(res);
    } catch (_err) {
      // CppClient already logged the transport failure — we swallow here
      // so a hung engine doesn't crash the socket handler.
    }
  }

  // ==================== response dispatch ====================

  _dispatch(res) {
    switch (res.res_id) {
      case CPP_REQ.CREATE_ROOM:     return this._onCreateRoom(res);
      case CPP_REQ.VALID_MOVES:     return this._onValidMoves(res);
      case CPP_REQ.UPDATE_POSITION: return this._onUpdatePosition(res);
      case CPP_REQ.CHECK_OR_MATE:   return this._onCheckOrMate(res);
      case CPP_REQ.UNDO_MOVE:       return this._onUndo(res);
      case CPP_REQ.REDO_MOVE:       return this._onRedo(res);
      case CPP_REQ.RESIGN:          return this._onResign(res);
      case CPP_REQ.RESET:           return this._onReset(res);
      case CPP_REQ.PAWN_PROMOTION:  return this._onPawnPromotion(res);
      default: log.warn("engine", `unknown res_id=${res.res_id}`);
    }
  }

  /** Returns true (and logs) when the engine flagged the response non-successful. */
  _failed(res, tag) {
    if (res.status === STATUS.SUCCESSFUL) return false;
    log.warn(`engine.${tag}`, `status=${res.status} room=${res.room_id}`);
    return true;
  }

  _onCreateRoom(res) {
    if (this._failed(res, "createRoom")) return;
    this.rooms.startGame(res.room_id);
    log.info("engine.createRoom", `game started in room=${res.room_id}`);
    this.io.to(res.room_id).emit(SOCKET_EVENT.START_GAME);
  }

  _onValidMoves(res) {
    if (this._failed(res, "validMoves")) return;
    this.io.to(res.room_id).emit(SOCKET_EVENT.SERVER_PIECE_FOCUS, res.player_id, res.position_array);
    this.rooms.storeValidMoves(res.room_id, res.player_id, res.piece_id, res.position_array);
  }

  _onUpdatePosition(res) {
    if (this._failed(res, "updatePosition")) return;
    this.io.to(res.room_id).emit(
      SOCKET_EVENT.SERVER_PIECE_MOVE,
      res.player_id, res.piece_id, res.old_position, res.position,
    );
    const next = this.rooms.swapTurn(res.room_id);
    if (next) this.io.to(res.room_id).emit(SOCKET_EVENT.CHANGE_TURN, next);
  }

  _onCheckOrMate(res) {
    if (this._failed(res, "checkOrMate")) return;
    log.debug("engine.checkOrMate", `room=${res.room_id} status=${res.check_or_mate_status}`);
    switch (res.check_or_mate_status) {
      case MATE_STATUS.CHECK_MATE: return this.io.to(res.room_id).emit(SOCKET_EVENT.CHECK_MATE, res.player_id);
      case MATE_STATUS.CHECK:      return this.io.to(res.room_id).emit(SOCKET_EVENT.CHECK,      res.player_id);
      case MATE_STATUS.STALE_MATE: return this.io.to(res.room_id).emit(SOCKET_EVENT.STALE_MATE, res.player_id);
      case MATE_STATUS.NIL:        return;
      default: log.warn("engine.checkOrMate", `unknown check_or_mate_status=${res.check_or_mate_status}`);
    }
  }

  _onUndo(res) {
    if (this._failed(res, "undo")) return;
    this.io.to(res.room_id).emit(
      SOCKET_EVENT.SERVER_UNDO,
      res.player_id, res.piece_id, res.position, res.is_demoted,
      res.revived_player_id, res.revived_piece_id, res.revived_position,
    );
    const next = this.rooms.swapTurn(res.room_id);
    if (next) this.io.to(res.room_id).emit(SOCKET_EVENT.CHANGE_TURN, next);
  }

  _onRedo(res) {
    if (this._failed(res, "redo")) return;
    this.io.to(res.room_id).emit(
      SOCKET_EVENT.SERVER_REDO,
      res.player_id, res.piece_id, res.position, res.pawn_promoted,
      res.killed_player_id, res.killed_piece_id, res.killed_position,
    );
    const next = this.rooms.swapTurn(res.room_id);
    if (next) this.io.to(res.room_id).emit(SOCKET_EVENT.CHANGE_TURN, next);
  }

  _onResign(res) {
    if (this._failed(res, "resign")) return;
    log.info("engine.resign", `room=${res.room_id} player=${res.player_id}`);
    this.io.to(res.room_id).emit(SOCKET_EVENT.SERVER_RESIGN, res.player_id);
  }

  _onReset(res) {
    if (this._failed(res, "reset")) return;
    this.rooms.startGame(res.room_id);
    log.info("engine.reset", `room=${res.room_id}`);
    this.io.to(res.room_id).emit(SOCKET_EVENT.SERVER_RESET, res.player_id);
  }

  _onPawnPromotion(res) {
    if (this._failed(res, "pawnPromotion")) return;
    log.debug("engine.pawnPromotion", `room=${res.room_id} piece=${res.piece_id} → ${res.new_piece_id}`);
    this.io.to(res.room_id).emit(
      SOCKET_EVENT.SERVER_PAWN_PROMOTION,
      res.player_id, res.piece_id, res.position, res.new_piece_id,
    );
    // Silence "value assigned but never used" — PLAYER is imported only so the
    // constants file stays the single source of truth for enum values.
    void PLAYER;
  }
}

module.exports = { GameEngine };
