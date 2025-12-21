import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Security: Generate source maps only for development
    sourcemap: process.env.NODE_ENV === 'development',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        }
      }
    }
  },
  server: {
    // Security: Strict file system access control
    fs: {
      strict: true,
      // Allow only specific directories
      allow: [
        path.resolve(import.meta.dirname, 'client'),
        path.resolve(import.meta.dirname, 'attached_assets'),
        path.resolve(import.meta.dirname, 'node_modules'),
        path.resolve(import.meta.dirname, 'shared'),
      ],
      // Deny sensitive files and directories
      deny: [
        '**/.*', // All dotfiles
        '**/node_modules/**/.env*', // Env files in node_modules
        '**/*.config.{js,ts,mjs,cjs}', // Config files
        '**/server/**', // Server code
        '**/migrations/**', // Database migrations
        '**/*.key', // Private keys
        '**/*.pem', // Certificates
        '**/package-lock.json', // Lock files
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
      ],
    },
    // CORS for dev server
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'],
      credentials: true,
    },
    // Security headers for dev server
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  // Preview server (for production builds)
  preview: {
    port: 4173,
    strictPort: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
});
