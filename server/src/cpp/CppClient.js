const net = require("net");
const { log } = require("../logger");

/**
 * Persistent connection to the C++ engine.
 *
 * One TCP connection, kept open for the life of the relay, carrying
 * newline-delimited JSON: each request is one line, each response one line.
 * Requests are tagged with an increasing `seq` that the engine echoes back,
 * so several can be in flight at once and each caller gets its own answer.
 *
 * If the connection drops (engine restart, redeploy), pending requests fail
 * immediately and the client reconnects with backoff. Requests made while
 * reconnecting wait for the connection, up to the request timeout.
 *
 * All transport concerns (timeouts, tracing, reconnects) live here so the
 * domain code in GameEngine stays declarative.
 */
class CppClient {
  constructor({ host, port, timeoutMs }) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.address = `tcp://${host}:${port}`;

    this._socket = null;
    this._connected = false;
    this._buffer = "";
    this._seq = 0;
    /** @type {Map<number, {resolve, reject, timer, req_id, started}>} */
    this._pending = new Map();
    /** Callers waiting for the connection to come up. */
    this._waiters = new Set();
    this._backoffMs = 100;
    this._closed = false;

    log.info("cpp", `engine client for ${this.address} (timeout=${timeoutMs}ms)`);
    this._connect();
  }

  /** Sends one request; resolves with the engine's response object. */
  async send(payload) {
    await this._whenConnected();
    const seq = ++this._seq;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(seq);
        log.error("cpp", `request ${payload.req_id} #${seq} timed out after ${this.timeoutMs}ms`);
        reject(new Error(`engine timeout (${payload.req_id})`));
      }, this.timeoutMs);
      this._pending.set(seq, { resolve, reject, timer, req_id: payload.req_id, started });
      log.trace("cpp", `→ #${seq} ${payload.req_id} room=${payload.room_id ?? "-"}`);
      this._socket.write(`${JSON.stringify({ ...payload, seq })}\n`);
    });
  }

  close() {
    this._closed = true;
    this._socket?.destroy();
  }

  // ---------- connection ----------

  _connect() {
    if (this._closed) return;
    const socket = net.createConnection({ host: this.host, port: this.port });
    this._socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 10_000);
    socket.setEncoding("utf8");

    socket.on("connect", () => {
      this._connected = true;
      this._backoffMs = 100;
      log.info("cpp", `connected to engine at ${this.address}`);
      for (const w of this._waiters) w.resolve();
      this._waiters.clear();
    });
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("error", (err) => {
      if (this._connected) log.error("cpp", `engine connection error: ${err.message}`);
      else log.debug("cpp", `engine not reachable yet: ${err.message}`);
    });
    socket.on("close", () => {
      const wasConnected = this._connected;
      this._connected = false;
      this._buffer = "";
      for (const [seq, p] of this._pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`engine connection lost (${p.req_id} #${seq})`));
      }
      this._pending.clear();
      if (this._closed) return;
      if (wasConnected) log.warn("cpp", "engine connection closed; reconnecting");
      setTimeout(() => this._connect(), this._backoffMs);
      this._backoffMs = Math.min(this._backoffMs * 2, 2000);
    });
  }

  _whenConnected() {
    if (this._connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = { resolve: () => { clearTimeout(timer); resolve(); } };
      const timer = setTimeout(() => {
        this._waiters.delete(waiter);
        reject(new Error(`engine unreachable at ${this.address}`));
      }, this.timeoutMs);
      this._waiters.add(waiter);
    });
  }

  _onData(chunk) {
    this._buffer += chunk;
    let nl;
    while ((nl = this._buffer.indexOf("\n")) !== -1) {
      const line = this._buffer.slice(0, nl);
      this._buffer = this._buffer.slice(nl + 1);
      if (line.trim()) this._onLine(line);
    }
  }

  _onLine(line) {
    let res;
    try {
      res = JSON.parse(line);
    } catch (err) {
      log.error("cpp", `unparseable engine response: ${line.slice(0, 200)}`);
      return;
    }
    const pending = this._pending.get(res.seq);
    if (!pending) {
      log.warn("cpp", `response for unknown request #${res.seq} (${res.res_id}); late after a timeout?`);
      return;
    }
    this._pending.delete(res.seq);
    clearTimeout(pending.timer);
    log.trace("cpp", `← #${res.seq} ${res.res_id} status=${res.status} (${Date.now() - pending.started}ms)`);
    if (res.status !== "SUCCESSFUL") {
      log.debug("cpp", `${res.res_id} #${res.seq}: ${res.status}${res.error ? ` (${res.error})` : ""}`);
    }
    pending.resolve(res);
  }
}

module.exports = { CppClient };
