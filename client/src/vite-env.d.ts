/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  /**
   * Override for the socket.io endpoint path. Only needed if the relay is
   * mounted somewhere other than "<base>socket.io/" (same-origin) or
   * "/socket.io/" (when VITE_SERVER_URL points straight at the node server).
   */
  readonly VITE_SOCKET_PATH?: string;
  /**
   * Compile-time default log level for the browser logger.
   * One of: TRACE | DEBUG | INFO | WARN | ERROR | FATAL. Defaults to INFO.
   * At runtime the viewer can override via
   *   localStorage.LOG_LEVEL = "DEBUG"; location.reload();
   */
  readonly VITE_LOG_LEVEL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
