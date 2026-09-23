import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests for the phone's data layer (src/core), run in Node against node:sqlite + a temp folder.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(import.meta.dirname, "../lib/$1") },
      { find: /^~\/(.*)$/, replacement: path.resolve(import.meta.dirname, "src/$1") },
    ],
  },
  test: { include: ["test/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});
