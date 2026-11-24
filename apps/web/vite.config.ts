import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    // app Worker(wrangler dev, 8787)로 API·WebSocket 전달
    proxy: {
      "/api": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
