import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev/build config for the chess client.
export default defineConfig({
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
