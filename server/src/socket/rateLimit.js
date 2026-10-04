/**
 * Per-socket rate limits: at most `max` calls of one kind in any `windowMs`.
 * A sliding window of timestamps per (socket, kind); tiny, and it goes away
 * with the socket (it lives in socket.data).
 *
 *   const allow = rateLimit(socket, "queue", { max: 6, windowMs: 10_000 });
 *   if (!allow()) return reply({ ok: false, error: "slow down" });
 */
function rateLimit(socket, kind, { max, windowMs }) {
  return () => {
    const now = Date.now();
    const store = (socket.data.rate ??= {});
    const hits = (store[kind] ??= []);
    while (hits.length && now - hits[0] >= windowMs) hits.shift();
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}

// Generous for people, tight for scripts.
const LIMITS = Object.freeze({
  queue: { max: 8, windowMs: 10_000 },      // queue:join + queue:leave
  roomCheck: { max: 10, windowMs: 10_000 }, // guessing room codes
  chat: { max: 12, windowMs: 10_000 },
});

module.exports = { rateLimit, LIMITS };
