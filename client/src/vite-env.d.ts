/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
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
