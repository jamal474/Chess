// Bridges the socket.io front-end with the C++ game-engine HTTP server.
const axios = require("axios");
const { log } = require("./logger");
const { ID } = require("./utils");
const { roomState } = require("./gameContext");

const CPP_HOST = process.env.CPP_HOST || "localhost";
const CPP_PORT = process.env.CPP_PORT || "5000";
const CPP_URL = `http://${CPP_HOST}:${CPP_PORT}`;

class NodeCppHandler {
  constructor(io) {
    this.io = io;
  }

  // ---------------- outbound requests ----------------

  createRoomRequest(roomId) {
    this.sendRequest({ req_id: "create_room", room_id: roomId });
  }

  getValidMovesRequest(roomId, playerId, pieceId) {
    this.sendRequest({
      req_id: "valid_moves",
      room_id: roomId,
      player_id: playerId,
      piece_id: pieceId,
    });
  }

  updatePositionRequest(roomId, playerId, pieceId, oldPosition, newPosition) {
    this.sendRequest({
      req_id: "update_position",
      room_id: roomId,
      player_id: playerId,
      piece_id: pieceId,
      old_position: oldPosition,
      position: newPosition,
    });
  }

  getCheckOrMateRequest(roomId, playerId) {
    this.sendRequest({
      req_id: "check_or_mate",
      room_id: roomId,
      player_id: playerId,
    });
  }

  undoMoveRequest(roomId, playerId) {
    this.sendRequest({ req_id: "undo_move", room_id: roomId, player_id: playerId });
  }

  redoMoveRequest(roomId, playerId) {
    this.sendRequest({ req_id: "redo_move", room_id: roomId, player_id: playerId });
  }

  resignRequest(roomId, playerId) {
    this.sendRequest({ req_id: "resign", room_id: roomId, player_id: playerId });
  }

  resetRequest(roomId, playerId) {
    this.sendRequest({ req_id: "reset", room_id: roomId, player_id: playerId });
  }

  pawnPromotionRequest(roomId, playerId, pieceId, position, newPieceId) {
    this.sendRequest({
      req_id: "pawn_promotion",
      room_id: roomId,
      player_id: playerId,
      piece_id: pieceId,
      position,
      new_piece_id: newPieceId,
    });
  }

  async sendRequest(request) {
    try {
      const { data } = await axios.post(CPP_URL, request, { timeout: 5000 });
      this.handleResponse(data);
    } catch (err) {
      log.error("cpp", `request ${request.req_id} failed: ${err.message}`);
    }
  }

  // ---------------- inbound responses ----------------

  handleResponse(res) {
    switch (res.res_id) {
      case "create_room":     return this.createRoomResponse(res);
      case "valid_moves":     return this.getValidMovesResponse(res);
      case "update_position": return this.updatePositionResponse(res);
      case "check_or_mate":   return this.getCheckorMateResponse(res);
      case "undo_move":       return this.undoMoveResponse(res);
      case "redo_move":       return this.redoMoveResponse(res);
      case "resign":          return this.resignResponse(res);
      case "reset":           return this.resetResponse(res);
      case "pawn_promotion":  return this.pawnPromotionResponse(res);
      default: log.warn("cpp", `unknown res_id: ${res.res_id}`);
    }
  }

  createRoomResponse(res) {
    if (res.status !== "SUCCESSFUL") return log.warn("cpp", "create_room failed");
    roomState[res.room_id].turn = ID.PLAYER1;
    roomState[res.room_id][ID.PLAYER1] = { moveMap: {}, alreadyPromotedPawns: [] };
    roomState[res.room_id][ID.PLAYER2] = { moveMap: {}, alreadyPromotedPawns: [] };
    this.io.to(res.room_id).emit("startGame");
  }

  getValidMovesResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit("serverPieceFocus", res.player_id, res.position_array);
    roomState[res.room_id][res.player_id].moveMap[res.piece_id] = res.position_array;
  }

  updatePositionResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit(
      "serverPieceMove",
      res.player_id,
      res.piece_id,
      res.old_position,
      res.position
    );
    const state = roomState[res.room_id];
    state.turn = state.turn === ID.PLAYER1 ? ID.PLAYER2 : ID.PLAYER1;
    this.io.to(res.room_id).emit("changeTurn", state.turn);
  }

  getCheckorMateResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    switch (res.check_or_mate_status) {
      case "CHECK_MATE": return this.io.to(res.room_id).emit("checkMate", res.player_id);
      case "CHECK":      return this.io.to(res.room_id).emit("check", res.player_id);
      case "STALE_MATE": return this.io.to(res.room_id).emit("staleMate", res.player_id);
      case "NIL":        return;
      default: log.warn("cpp", `unknown check_or_mate_status: ${res.check_or_mate_status}`);
    }
  }

  undoMoveResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit(
      "serverUndo",
      res.player_id, res.piece_id, res.position, res.is_demoted,
      res.revived_player_id, res.revived_piece_id, res.revived_position
    );
    const state = roomState[res.room_id];
    state.turn = state.turn === ID.PLAYER1 ? ID.PLAYER2 : ID.PLAYER1;
    this.io.to(res.room_id).emit("changeTurn", state.turn);
  }

  redoMoveResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit(
      "serverRedo",
      res.player_id, res.piece_id, res.position, res.pawn_promoted,
      res.killed_player_id, res.killed_piece_id, res.killed_position
    );
    const state = roomState[res.room_id];
    state.turn = state.turn === ID.PLAYER1 ? ID.PLAYER2 : ID.PLAYER1;
    this.io.to(res.room_id).emit("changeTurn", state.turn);
  }

  resignResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit("serverResign", res.player_id);
  }

  resetResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    roomState[res.room_id].turn = ID.PLAYER1;
    roomState[res.room_id][ID.PLAYER1] = { moveMap: {}, alreadyPromotedPawns: [] };
    roomState[res.room_id][ID.PLAYER2] = { moveMap: {}, alreadyPromotedPawns: [] };
    this.io.to(res.room_id).emit("serverReset", res.player_id);
  }

  pawnPromotionResponse(res) {
    if (res.status !== "SUCCESSFUL") return;
    this.io.to(res.room_id).emit(
      "serverPawnPromotion",
      res.player_id, res.piece_id, res.position, res.new_piece_id
    );
  }
}

module.exports = NodeCppHandler;
