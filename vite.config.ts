import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The whole game builds into a single self-contained index.html,
// so it can be hosted anywhere (GitHub Pages, an artifact, a USB stick).
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
} as any);
