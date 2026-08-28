import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "../../packages/shared/src"),
      "@assets": path.resolve(import.meta.dirname, "../../attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname, "../.."), // Read root .env
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
