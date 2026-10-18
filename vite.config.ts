import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
