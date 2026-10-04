import { io, Socket, type ManagerOptions, type SocketOptions } from "socket.io-client";
import { log } from "./logger";
import { getClientId } from "./identity";

// If VITE_SERVER_URL is set we connect there; otherwise same-origin (works when
// the node server is proxied by nginx under the app's base path).
const url = import.meta.env.VITE_SERVER_URL as string | undefined;

// socket.io's `path` is host-absolute — unlike asset URLs it does not inherit
// Vite's base, so mounting the app at /chess/ would otherwise leave the
// handshake knocking at /socket.io/ on the domain root. Same-origin it has to
// carry the mount prefix (nginx proxies /chess/socket.io/ onward, and the node
// server is configured with the matching SOCKET_IO_PATH). Pointed straight at
// the node server it must not — that server answers on its own root.
const path =
  (import.meta.env.VITE_SOCKET_PATH as string | undefined) ||
  (url ? "/socket.io/" : `${import.meta.env.BASE_URL}socket.io/`);

const options: Partial<ManagerOptions & SocketOptions> = {
  autoConnect: true,
  transports: ["websocket", "polling"],
  path,
  // Lets the relay count browsers rather than tabs, and never pair a
  // browser with itself in matchmaking.
  auth: { clientId: getClientId() },
};

export const socket: Socket = url ? io(url, options) : io(options);

// Attach connect / disconnect logs once. Same tag ("socket") across states.
socket.on("connect", () => {
  log.info("socket", `connected ${socket.id ?? "(no id)"} → ${url ?? "(same-origin)"}${path}`);
});
socket.on("disconnect", (reason) => {
  log.warn("socket", `disconnected: ${reason}`);
});
socket.on("connect_error", (err) => {
  log.error("socket", `connect_error: ${err.message}`);
});
