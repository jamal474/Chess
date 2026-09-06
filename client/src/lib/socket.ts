import { io, Socket } from "socket.io-client";
import { log } from "./logger";

// If VITE_SERVER_URL is set we connect there; otherwise same-origin (works when
// the node server is proxied by nginx at "/").
const url = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: Socket = url
  ? io(url, { autoConnect: true, transports: ["websocket", "polling"] })
  : io({ autoConnect: true, transports: ["websocket", "polling"] });

// Attach connect / disconnect logs once. Same tag ("socket") across states.
socket.on("connect", () => {
  log.info("socket", `connected ${socket.id ?? "(no id)"} → ${url ?? "(same-origin)"}`);
});
socket.on("disconnect", (reason) => {
  log.warn("socket", `disconnected: ${reason}`);
});
socket.on("connect_error", (err) => {
  log.error("socket", `connect_error: ${err.message}`);
});
