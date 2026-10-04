const { SOCKET_EVENT, LOBBY_STATS_INTERVAL_MS, LOBBY_ROOM } = require("../constants");

/**
 * Live counts for the menu: { online, searching, playing }.
 *
 *   online    — distinct browsers connected (one person with three tabs is one),
 *               kept as a count per browser id as sockets come and go;
 *   searching — players in the matchmaking queue;
 *   playing   — players seated in games that have started.
 *
 * Only sockets that subscribed (the menu page) get them, through the "lobby"
 * socket.io room. A tick every LOBBY_STATS_INTERVAL_MS sends them, and only
 * when someone is subscribed and a number changed; subscribing returns the
 * current counts right away so the menu never waits for a tick.
 */
class Lobby {
  constructor({ io, rooms, matchmaker, intervalMs = LOBBY_STATS_INTERVAL_MS }) {
    this.io = io;
    this.rooms = rooms;
    this.matchmaker = matchmaker;
    /** @type {Map<string, number>} browser id → open sockets */
    this.clients = new Map();
    this._last = "";
    this._timer = setInterval(() => this._tick(), intervalMs);
    this._timer.unref?.();
  }

  connected(socket) {
    const id = socket.data.clientId || socket.id;
    this.clients.set(id, (this.clients.get(id) || 0) + 1);
  }

  disconnected(socket) {
    const id = socket.data.clientId || socket.id;
    const n = (this.clients.get(id) || 1) - 1;
    if (n > 0) this.clients.set(id, n);
    else this.clients.delete(id);
  }

  stats() {
    return {
      online: this.clients.size,
      searching: this.matchmaker.size(),
      playing: this.rooms.playingCount(),
    };
  }

  subscribe(socket) {
    socket.join(LOBBY_ROOM);
    return this.stats();
  }

  unsubscribe(socket) {
    socket.leave(LOBBY_ROOM);
  }

  _tick() {
    if (!this.io.sockets.adapter.rooms.get(LOBBY_ROOM)?.size) return;
    const stats = this.stats();
    const key = `${stats.online}/${stats.searching}/${stats.playing}`;
    if (key === this._last) return;
    this._last = key;
    this.io.to(LOBBY_ROOM).emit(SOCKET_EVENT.LOBBY_STATS, stats);
  }

  stop() {
    clearInterval(this._timer);
  }
}

module.exports = { Lobby };
