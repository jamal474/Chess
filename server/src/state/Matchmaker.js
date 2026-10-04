const crypto = require("crypto");
const { PLAYER, SOCKET_EVENT, MATCH_CLAIM_TIMEOUT_MS } = require("../constants");
const { log } = require("../logger");

/**
 * Pairs players who want a game with anyone.
 *
 * The queue is a Map keyed by socket id. Maps keep insertion order, so the
 * first entry is whoever has waited longest, and join / leave / take-oldest
 * are all O(1). There's no matching loop: pairing happens inside join(), the
 * moment a second player arrives.
 *
 * A match creates a room with both seats reserved, each by a one-time ticket,
 * and sends each player { roomId, playerId, ticket, opponent }. They then
 * open the game page and joinRoom(roomId, ticket) like any other room; when
 * both are seated the engine sets up the board. Seats are reserved rather
 * than taken for them so nothing the game page listens for (startGame,
 * legalMoves) is sent before it has loaded.
 *
 * If both haven't taken their seats within MATCH_CLAIM_TIMEOUT_MS, the match
 * is called off: whoever did show up goes back to the front of the queue.
 *
 * The matching rule is canPair(); today any two different browsers pair.
 * Ratings or time controls would go there.
 */
class Matchmaker {
  constructor({ io, rooms, claimTimeoutMs = MATCH_CLAIM_TIMEOUT_MS }) {
    this.io = io;
    this.rooms = rooms;
    this.claimTimeoutMs = claimTimeoutMs;
    /** @type {Map<string, Entry>} socket id → entry, oldest first */
    this.queue = new Map();
    /** @type {Map<string, Pending>} roomId → match waiting for both players to sit */
    this.pending = new Map();
  }

  /** Players waiting for an opponent. */
  size() {
    return this.queue.size;
  }

  isQueued(socketId) {
    return this.queue.has(socketId);
  }

  /**
   * Puts the socket in the queue, or pairs it straight away.
   * @returns {"searching" | "matched"}
   */
  join(socket, profile) {
    const entry = {
      socketId: socket.id,
      clientId: socket.data.clientId || socket.id,
      profile,
      since: Date.now(),
    };
    if (this.queue.has(socket.id)) {
      // Already waiting: keep the place in line, refresh the profile.
      this.queue.get(socket.id).profile = profile;
      return "searching";
    }
    return this._enqueue(entry);
  }

  /** Takes the socket out of the queue. Returns whether it was in it. */
  leave(socketId) {
    const was = this.queue.delete(socketId);
    if (was) log.debug("match", `socket=${socketId} left the queue (${this.queue.size} waiting)`);
    return was;
  }

  /** Called when someone sits in a matchmade room: once both are in, the match holds. */
  seated(roomId) {
    const p = this.pending.get(roomId);
    if (!p || this.rooms.occupied(roomId) < 2) return;
    clearTimeout(p.timer);
    this.pending.delete(roomId);
    log.info("match", `room=${roomId} both players seated after ${Date.now() - p.at}ms`);
  }

  // ==================== internals ====================

  /** Two queue entries may play each other. */
  canPair(a, b) {
    return a.clientId !== b.clientId; // never yourself in another tab
  }

  _enqueue(entry, { front = false } = {}) {
    for (const other of this.queue.values()) {
      if (!this.canPair(other, entry)) continue;
      this.queue.delete(other.socketId);
      this._pair(other, entry);
      return "matched";
    }
    if (front) this.queue = new Map([[entry.socketId, entry], ...this.queue]);
    else this.queue.set(entry.socketId, entry);
    log.debug("match", `socket=${entry.socketId} waiting (${this.queue.size} in queue)`);
    return "searching";
  }

  /** `a` waited longer. Colours are random. */
  _pair(a, b) {
    const roomId = this._newRoomId();
    const [seatA, seatB] = Math.random() < 0.5 ? [PLAYER.PLAYER1, PLAYER.PLAYER2] : [PLAYER.PLAYER2, PLAYER.PLAYER1];
    const tickets = { [seatA]: ticket(), [seatB]: ticket() };

    this.rooms.create(roomId, seatA);
    this.rooms.setMatch(roomId, { tickets });
    this.rooms.setProfile(roomId, seatA, a.profile);
    this.rooms.setProfile(roomId, seatB, b.profile);

    const timer = setTimeout(() => this._expire(roomId), this.claimTimeoutMs);
    timer.unref?.();
    this.pending.set(roomId, { at: Date.now(), timer, seats: { [seatA]: a, [seatB]: b } });

    const send = (entry, seat, opp) =>
      this.io.to(entry.socketId).emit(SOCKET_EVENT.MATCH_FOUND, {
        roomId, playerId: seat, ticket: tickets[seat], opponent: opp.profile,
      });
    send(a, seatA, b);
    send(b, seatB, a);
    log.info("match", `room=${roomId} ${a.profile.name} (${seatA}, waited ${Date.now() - a.since}ms) vs ${b.profile.name} (${seatB})`);
  }

  /** Not everyone sat down in time: call the match off. */
  _expire(roomId) {
    const p = this.pending.get(roomId);
    this.pending.delete(roomId);
    if (!p || this.rooms.isStarted(roomId)) return;

    const room = this.rooms.get(roomId);
    const requeue = [];
    for (const seat of [PLAYER.PLAYER1, PLAYER.PLAYER2]) {
      const sid = room?.seats[seat];
      const socket = sid && this.io.sockets.sockets.get(sid);
      if (socket) {
        // Showed up: out of the room, back to the front of the line.
        socket.leave(roomId);
        this.rooms.unbindSocket(sid);
        socket.emit(SOCKET_EVENT.MATCH_CANCELLED, { reason: "opponent-missing", requeued: true });
        requeue.push({ ...p.seats[seat], socketId: sid, clientId: socket.data.clientId || sid, since: Date.now() });
      } else {
        this.io.to(p.seats[seat].socketId).emit(SOCKET_EVENT.MATCH_CANCELLED, { reason: "timeout", requeued: false });
      }
    }
    this.rooms.dispose(roomId); // the engine never had this board
    log.info("match", `room=${roomId} called off: ${requeue.length ? "one" : "neither"} player showed up`);
    for (const e of requeue) this._enqueue(e, { front: true });
  }

  _newRoomId() {
    let id;
    do id = `M${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    while (this.rooms.has(id));
    return id;
  }
}

const ticket = () => crypto.randomBytes(16).toString("base64url");

module.exports = { Matchmaker };
