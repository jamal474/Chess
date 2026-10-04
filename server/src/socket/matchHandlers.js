const { SOCKET_EVENT } = require("../constants");
const { log } = require("../logger");
const { cleanProfile } = require("./roomHandlers");

/**
 * Lobby counts and the matchmaking queue:
 *   * lobby:subscribe / lobby:unsubscribe — the menu wants live counts.
 *   * queue:join (profile, ack) — find me an opponent. Answers
 *       { ok, status: "searching" | "matched" }; a match also sends
 *       match:found to both players.
 *   * queue:leave — stop searching.
 */
function attachMatchHandlers(socket, { rooms, matchmaker, lobby }) {
  const reply = (cb, v) => typeof cb === "function" && cb(v);

  socket.on(SOCKET_EVENT.LOBBY_SUBSCRIBE, (cb) => reply(cb, { ok: true, stats: lobby.subscribe(socket) }));
  socket.on(SOCKET_EVENT.LOBBY_UNSUBSCRIBE, () => lobby.unsubscribe(socket));

  socket.on(SOCKET_EVENT.QUEUE_JOIN, (profile, cb) => {
    const clean = cleanProfile(profile);
    if (!clean) return reply(cb, { ok: false, error: "a name is needed to play" });
    if (rooms.roomIdFor(socket.id)) return reply(cb, { ok: false, error: "already in a game" });
    const status = matchmaker.join(socket, clean);
    reply(cb, { ok: true, status });
  });

  socket.on(SOCKET_EVENT.QUEUE_LEAVE, (cb) => {
    matchmaker.leave(socket.id);
    reply(cb, { ok: true });
  });
}

/** Valid browser id from the handshake, else the socket id. */
function clientIdFrom(socket) {
  const v = socket.handshake?.auth?.clientId;
  if (typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v)) return v;
  log.debug("io", `socket=${socket.id} has no client id; counting it alone`);
  return socket.id;
}

module.exports = { attachMatchHandlers, clientIdFrom };
