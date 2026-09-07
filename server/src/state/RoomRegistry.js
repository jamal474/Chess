const { PLAYER } = require("../constants");
const { log } = require("../logger");

/**
 * RoomRegistry — the single source of truth for every in-flight game room.
 *
 * Two maps:
 *   * socketToRoom (socket.id → roomId): so we can find a socket's room in
 *     O(1) inside every event handler, without asking socket.io's adapter.
 *   * rooms       (roomId    → Room):    the game state itself.
 *
 * A Room lives from `create()` (creator lands) → `dispose()` (last socket
 * leaves). During gameplay we track:
 *   - whose turn it is;
 *   - the last set of valid moves the engine sent for each of a player's
 *     pieces, so pieceMove can be authorised without an extra engine round-trip;
 *   - which of a player's pawns have already been auto-promoted (mirrors the
 *     client's own bookkeeping so undo/redo can restore it).
 */
class RoomRegistry {
  constructor() {
    /** @type {Map<string, string>} socket.id → roomId */
    this._socketToRoom = new Map();
    /** @type {Map<string, Room>}   roomId → Room */
    this._rooms = new Map();
  }

  // ---------- socket lifecycle ----------

  bindSocket(socketId, roomId) {
    this._socketToRoom.set(socketId, roomId);
  }

  roomIdFor(socketId) {
    return this._socketToRoom.get(socketId) || null;
  }

  /** Returns the roomId the socket was in, or null if unknown. */
  unbindSocket(socketId) {
    const roomId = this._socketToRoom.get(socketId) || null;
    this._socketToRoom.delete(socketId);
    return roomId;
  }

  // ---------- room lifecycle ----------

  create(roomId, creatorId) {
    this._rooms.set(roomId, {
      roomId,
      creatorId,
      turn: null, // populated by startGame() after the engine confirms
      players: {
        [PLAYER.PLAYER1]: { moveMap: {}, alreadyPromotedPawns: [] },
        [PLAYER.PLAYER2]: { moveMap: {}, alreadyPromotedPawns: [] },
      },
    });
    log.debug("rooms", `create room=${roomId} creator=${creatorId}`);
  }

  dispose(roomId) {
    if (this._rooms.delete(roomId)) log.debug("rooms", `dispose room=${roomId}`);
  }

  has(roomId) {
    return this._rooms.has(roomId);
  }

  get(roomId) {
    return this._rooms.get(roomId) || null;
  }

  size() {
    return this._rooms.size;
  }

  /** Called after the engine says create_room / reset succeeded. */
  startGame(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    room.turn = PLAYER.PLAYER1;
    room.players[PLAYER.PLAYER1] = { moveMap: {}, alreadyPromotedPawns: [] };
    room.players[PLAYER.PLAYER2] = { moveMap: {}, alreadyPromotedPawns: [] };
  }

  currentTurn(roomId) {
    return this._rooms.get(roomId)?.turn ?? null;
  }

  swapTurn(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    room.turn = room.turn === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1;
    return room.turn;
  }

  // ---------- per-turn move authorisation ----------

  storeValidMoves(roomId, playerId, pieceId, positions) {
    const player = this._rooms.get(roomId)?.players?.[playerId];
    if (!player) return;
    player.moveMap[pieceId] = positions;
  }

  storedValidMoves(roomId, playerId, pieceId) {
    return this._rooms.get(roomId)?.players?.[playerId]?.moveMap?.[pieceId] || null;
  }

  // ---------- pawn-promotion bookkeeping ----------

  getAlreadyPromoted(roomId, playerId) {
    return this._rooms.get(roomId)?.players?.[playerId]?.alreadyPromotedPawns || [];
  }

  setAlreadyPromoted(roomId, playerId, list) {
    const player = this._rooms.get(roomId)?.players?.[playerId];
    if (!player) return;
    player.alreadyPromotedPawns = Array.isArray(list) ? list : [];
  }

  // ---------- helpers used by the room-exists check ----------

  /** The other seat's player-id (opposite of whoever created the room). */
  otherPlayerId(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return null;
    return room.creatorId === PLAYER.PLAYER1 ? PLAYER.PLAYER2 : PLAYER.PLAYER1;
  }
}

module.exports = { RoomRegistry };
