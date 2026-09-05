import { io, Socket } from "socket.io-client";

// If VITE_SERVER_URL is set we connect there; otherwise same-origin (works when
// the node server is proxied by nginx at "/").
const url = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: Socket = url
  ? io(url, { autoConnect: true, transports: ["websocket", "polling"] })
  : io({ autoConnect: true, transports: ["websocket", "polling"] });
