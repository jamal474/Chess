const { PLAYER, SOCKET_EVENT, MAX_NAME_LENGTH } = require("../constants");
const { log } = require("../logger");
const { buildSnapshot } = require("../state/snapshot");

/**
 * Room lifecycle over socket.io:
 *   * roomExistsCheck — the join dialog on the menu page asks whether a code
 *     is joinable and which seat it'd take.
 *   * createRoom      — one player claims a code and picks a colour.
 *   * joinRoom        — a player takes the empty seat. In a fresh room that
 *                       kicks the engine into setting up the board (it then
 *                       broadcasts startGame). In a game already under way
 *                       the newcomer is sent the position and play resumes.
 *   * leaveRoom       — a player leaves the game page (a closed tab or lost
 *                       connection counts the same, see leaveRoom() below).
 *                       A game in progress pauses until the seat is taken.
 *   * setProfile      — a player names themselves (and their country); the
 *                       room gets both profiles back as serverProfiles.
 */
function attachRoomHandlers(socket, deps) {
  const { io, rooms, engine } = deps;

  socket.on(SOCKET_EVENT.ROOM_EXISTS_CHECK, (roomId, cb) => {
    const respond = (canJoin, joinerPlayerId) =>
      typeof cb === "function" && cb(canJoin, joinerPlayerId || "");
    try {
      if (!isValidRoomId(roomId)) return respond(false, "");
      const seat = rooms.has(roomId) ? rooms.freeSeat(roomId) : null;
      const canJoin = Boolean(seat) && rooms.occupied(roomId) >= 1;
      log.debug("room.exists", `room=${roomId} canJoin=${canJoin} seat=${seat ?? "-"}`);
      respond(canJoin, canJoin ? seat : "");
    } catch (err) {
      log.error("room.exists", `error for room=${roomId}: ${err.message}`);
      respond(false, "");
    }
  });

  socket.on(SOCKET_EVENT.CREATE_ROOM, (roomId, chosenPlayerId) => {
    if (!isValidRoomId(roomId)) return log.warn("room.create", `bad roomId=${JSON.stringify(roomId)}`);
    if (!isValidPlayerId(chosenPlayerId))
      return log.warn("room.create", `bad chosenPlayerId=${JSON.stringify(chosenPlayerId)}`);
    if (rooms.roomIdFor(socket.id) === roomId) return; // already here (page re-mounted)

    if (rooms.has(roomId)) {
      // The creator reloading the page: their seat is free again, take it back.
      if (rooms.isSeatFree(roomId, chosenPlayerId) && rooms.occupied(roomId) > 0) {
        log.info("room.create", `socket=${socket.id} back in room=${roomId} as ${chosenPlayerId}`);
        return takeSeat(roomId, chosenPlayerId);
      }
      return log.warn("room.create", `duplicate roomId=${roomId}`);
    }

    leaveRoom(socket, deps); // from any room this socket was still in
    socket.join(roomId);
    rooms.create(roomId, chosenPlayerId);
    rooms.bindSocket(socket.id, roomId);
    rooms.sit(roomId, chosenPlayerId, socket.id);
    log.info("room.create", `socket=${socket.id} created room=${roomId} as ${chosenPlayerId} (rooms=${rooms.size()})`);
  });

  socket.on(SOCKET_EVENT.JOIN_ROOM, (roomId) => {
    if (!isValidRoomId(roomId)) return log.warn("room.join", `bad roomId=${JSON.stringify(roomId)}`);
    if (rooms.roomIdFor(socket.id) === roomId) return; // already here (page re-mounted)
    if (!rooms.has(roomId)) return log.warn("room.join", `room=${roomId} does not exist`);
    const seat = rooms.freeSeat(roomId);
    if (!seat) return log.warn("room.join", `room=${roomId} already full`);
    takeSeat(roomId, seat);
  });

  socket.on(SOCKET_EVENT.LEAVE_ROOM, () => leaveRoom(socket, deps));

  /** Sits this socket in `seat` and starts, resumes or restarts the game as needed. */
  async function takeSeat(roomId, seat) {
    leaveRoom(socket, deps);
    socket.join(roomId);
    rooms.bindSocket(socket.id, roomId);
    rooms.sit(roomId, seat, socket.id);
    log.info("room.join", `socket=${socket.id} took ${seat} in room=${roomId}`);

    // The newcomer needs whatever the other player already told us about themselves.
    io.to(roomId).emit(SOCKET_EVENT.SERVER_PROFILES, rooms.profiles(roomId));

    if (!rooms.isStarted(roomId)) {
      // Fresh room: the engine's answer fires `startGame` on both sockets.
      if (rooms.occupied(roomId) === 2) engine.createRoom(roomId);
      return;
    }

    rooms.setPaused(roomId, false);

    if (rooms.isOver(roomId)) {
      // The last game had ended: a new opponent gets a new game.
      log.info("room.join", `room=${roomId} game was over, starting a new one`);
      socket.emit(SOCKET_EVENT.START_GAME);
      await engine.reset(roomId, seat);
      io.to(roomId).emit(SOCKET_EVENT.SERVER_UNDO_STATE, rooms.undoState(roomId), null);
      io.to(roomId).emit(SOCKET_EVENT.SERVER_PRESENCE, rooms.presence(roomId));
      return;
    }

    // Game under way: hand the newcomer the position and carry on.
    rooms.resetUndos(roomId, seat);
    const snapshot = buildSnapshot(rooms.moves(roomId));
    socket.emit(SOCKET_EVENT.SERVER_SNAPSHOT, {
      ...snapshot,
      turn: rooms.currentTurn(roomId),
      elapsed: rooms.elapsed(roomId),
    });
    io.to(roomId).emit(SOCKET_EVENT.SERVER_UNDO_STATE, rooms.undoState(roomId), null);
    io.to(roomId).emit(SOCKET_EVENT.SERVER_PRESENCE, rooms.presence(roomId));
    log.info("room.join", `room=${roomId} resumed at ply ${rooms.moves(roomId).length} with a new ${seat}`);
    // Legal moves and check status for whoever is to move.
    await engine.refreshTurn(roomId);
  }

  socket.on(SOCKET_EVENT.SET_PROFILE, (playerId, profile) => {
    const roomId = rooms.roomIdFor(socket.id);
    if (!roomId || !rooms.has(roomId)) return;
    if (!isValidPlayerId(playerId)) return log.warn("room.profile", `bad playerId=${JSON.stringify(playerId)}`);
    const clean = cleanProfile(profile);
    if (!clean) return log.warn("room.profile", `bad profile from ${playerId} in room=${roomId}`);

    rooms.setProfile(roomId, playerId, clean);
    io.to(roomId).emit(SOCKET_EVENT.SERVER_PROFILES, rooms.profiles(roomId));
    log.info("room.profile", `room=${roomId} ${playerId} is "${clean.name}" (${clean.country?.code ?? "--"})`);
  });
}

/**
 * Takes `socket` out of its room, if it's in one. The last one out disposes
 * of the room (and the engine's board). Otherwise the other player is told,
 * and a game in progress is paused until someone takes the seat.
 */
function leaveRoom(socket, { io, rooms, engine }) {
  const roomId = rooms.unbindSocket(socket.id);
  if (!roomId) return null;
  socket.leave(roomId);
  const seat = rooms.stand(roomId, socket.id);

  if (rooms.occupied(roomId) === 0) {
    rooms.dispose(roomId);
    engine.deleteRoom(roomId);
    log.info("room.leave", `socket=${socket.id} left room=${roomId} (last, disposed)`);
    return roomId;
  }

  if (rooms.isStarted(roomId)) {
    if (rooms.clearPendingUndo(roomId)) {
      io.to(roomId).emit(SOCKET_EVENT.SERVER_UNDO_STATE, rooms.undoState(roomId), null);
    }
    if (!rooms.isOver(roomId)) rooms.setPaused(roomId, true);
  }
  if (seat) rooms.setProfile(roomId, seat, null);
  io.to(roomId).emit(SOCKET_EVENT.SERVER_PROFILES, rooms.profiles(roomId));
  io.to(roomId).emit(SOCKET_EVENT.SERVER_PRESENCE, rooms.presence(roomId, seat));
  log.info("room.leave", `socket=${socket.id} (${seat ?? "?"}) left room=${roomId}${rooms.isPaused(roomId) ? ", game paused" : ""}`);
  return roomId;
}

/** { name, country: { code, name } | null } with the name trimmed and clipped, or null if unusable. */
function cleanProfile(v) {
  if (!v || typeof v !== "object" || typeof v.name !== "string") return null;
  // Drop control characters, collapse whitespace.
  const name = v.name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return null;
  let country = null;
  const c = v.country;
  if (c && typeof c === "object" && typeof c.code === "string" && /^[a-z]{2}$/i.test(c.code)) {
    country = {
      code: c.code.toLowerCase(),
      name: typeof c.name === "string" ? c.name.slice(0, 64) : c.code.toUpperCase(),
    };
  }
  return { name, country };
}

function isValidRoomId(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}
function isValidPlayerId(v) {
  return v === PLAYER.PLAYER1 || v === PLAYER.PLAYER2;
}

module.exports = { attachRoomHandlers, leaveRoom };
