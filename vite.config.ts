import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


export default defineConfig({
  plugins: [react()],
  define: {
    process: JSON.stringify({
      env: { LEARN_HOST: process.env.LEARN_HOST || "" },
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT || 5000}`,
        changeOrigin: false,
        secure: false,
      },
      "/cases": {
        target: `http://localhost:${process.env.PORT || 5000}`,
        changeOrigin: true,
        secure: false,
      },
      "/_next": {
        target: `http://localhost:${process.env.PORT || 5000}`,
        changeOrigin: true,
        secure: false,
      },
      "/login": {
        target: `http://localhost:${process.env.PORT || 5000}`,
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
