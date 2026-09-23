import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

export function setup() {
  const root = process.env.WARDROBE_TEST_ROOT!;
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
}

export function teardown() {
  rmSync(process.env.WARDROBE_TEST_ROOT!, { recursive: true, force: true });
}
