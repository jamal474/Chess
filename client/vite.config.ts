import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client is served from https://<short-domain>/chess/, so asset URLs,
// the router basename and the socket.io path all hang off this one value.
// Overridable at build time with BASE_PATH (must start and end with "/");
// the Dockerfile derives it from its APP_BASE build arg so the nginx layout
// and the bundle can never disagree.
const base = process.env.BASE_PATH || "/chess/";

// Vite dev/build config for the chess client.
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
