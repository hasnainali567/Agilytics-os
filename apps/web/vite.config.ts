import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Tailwind v4 needs its Vite plugin — without it, `@import "tailwindcss"`
  // in index.css is never processed, no utilities or @theme tokens are
  // generated, and the whole app renders unstyled (data still loads).
  plugins: [react(), tailwindcss()],
  resolve: {
    // Bundle the shared package from source, not from its CommonJS dist:
    // the CJS dist is for the NestJS API/worker (Node require), but Rollup
    // cannot see named exports through the CJS re-export helpers, so the
    // production build failed with "X is not exported by @agilytics/shared".
    // This mirrors the tsconfig `paths` mapping already used for typecheck.
    alias: {
      "@agilytics/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
