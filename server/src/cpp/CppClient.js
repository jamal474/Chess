const axios = require("axios");
const { log } = require("../logger");

/**
 * Thin HTTP transport to the C++ chess engine.
 * All transport-level concerns (timeouts, tracing, retry policy) live here
 * so the domain code in GameEngine stays declarative.
 */
class CppClient {
  constructor({ host, port, timeoutMs }) {
    this.host = host;
    this.port = port;
    this.baseUrl = `http://${host}:${port}`;
    this._axios = axios.create({ timeout: timeoutMs });
    log.info("cpp", `client configured for ${this.baseUrl} (timeout=${timeoutMs}ms)`);
  }

  /**
   * Send one request/response cycle to the engine.
   * Throws on transport failure — callers may choose to log and swallow.
   */
  async send(payload) {
    const started = Date.now();
    log.trace("cpp", `→ ${payload.req_id} room=${payload.room_id ?? "-"}`);
    try {
      const { data } = await this._axios.post(this.baseUrl, payload);
      log.trace(
        "cpp",
        `← ${data?.res_id ?? "?"} status=${data?.status ?? "?"} (${Date.now() - started}ms)`
      );
      return data;
    } catch (err) {
      log.error(
        "cpp",
        `request ${payload.req_id} failed after ${Date.now() - started}ms: ${err.message}`
      );
      throw err;
    }
  }
}

module.exports = { CppClient };
