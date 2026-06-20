import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR ?? "/tmp/arduino-blocks-lab-vite",
  plugins: [react()],
  base: process.env.GITHUB_PAGES === "true" ? "/arduino-blocks-lab/" : "/",
  resolve: {
    alias: {
      "@abl/block-schema": r("../../packages/block-schema/src/index.ts"),
      "@abl/catalog": r("../../packages/catalog/src/index.ts"),
      "@abl/codegen": r("../../packages/codegen/src/index.ts")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
