import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

// Tests run against a throwaway database + data folder, never your real wardrobe.
const root = path.join(os.tmpdir(), `wardrobe-test-${process.pid}`);
process.env.WARDROBE_TEST_ROOT = root;
process.env.WARDROBE_DATA_DIR = path.join(root, "data");
process.env.DATABASE_URL = `file:${path.join(root, "test.db")}`;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      WARDROBE_DATA_DIR: process.env.WARDROBE_DATA_DIR,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  },
});
