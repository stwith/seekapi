import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = process.env.VITE_API_PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
