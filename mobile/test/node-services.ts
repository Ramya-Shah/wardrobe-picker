import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "~/core/schema";
import type { Db, FileStore, Services, SqlValue } from "~/core/services";

/** node:sqlite-backed Db with the same semantics as the expo-sqlite adapter. */
function nodeDb(file: string): Db {
  const sqlite = new DatabaseSync(file);
  const db: Db = {
    async exec(sql) {
      sqlite.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async transaction(fn) {
      sqlite.exec("BEGIN");
      try {
        const r = await fn(db);
        sqlite.exec("COMMIT");
        return r;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return db;
}

const nodeFiles: FileStore = {
  readBytes: async (p) => new Uint8Array(fs.readFileSync(p)),
  readText: async (p) => fs.readFileSync(p, "utf8"),
  writeBytes: async (p, d) => fs.writeFileSync(p, d),
  writeText: async (p, t) => fs.writeFileSync(p, t),
  exists: async (p) => fs.existsSync(p),
  size: async (p) => fs.statSync(p).size,
  remove: async (p) => fs.rmSync(p, { force: true }),
  removeDir: async (p) => fs.rmSync(p, { recursive: true, force: true }),
  ensureDir: async (p) => void fs.mkdirSync(p, { recursive: true }),
  list: async (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []),
  move: async (a, b) => fs.renameSync(a, b),
  copy: async (a, b) => fs.copyFileSync(a, b),
  openWriter(p) {
    const fd = fs.openSync(p, "w");
    return { write: (b) => void fs.writeSync(fd, b), close: () => fs.closeSync(fd) };
  },
  openReader(p) {
    const fd = fs.openSync(p, "r");
    const size = fs.fstatSync(fd).size;
    let pos = 0;
    return {
      size,
      read(n) {
        const buf = Buffer.alloc(n);
        const got = fs.readSync(fd, buf, 0, n, pos);
        pos += got;
        return new Uint8Array(buf.subarray(0, got));
      },
      close: () => fs.closeSync(fd),
    };
  },
};

export async function makeServices(): Promise<Services & { root: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wardrobe-mobile-"));
  const svc: Services & { root: string } = {
    root,
    db: nodeDb(path.join(root, "wardrobe.db")),
    files: nodeFiles,
    images: {
      // Thumbnails need a native image library on the phone; tests just copy the file.
      async makeThumbnail(source, target) {
        fs.copyFileSync(source, target);
        return { width: 40, height: 60 };
      },
      async convertToJpeg() {
        return false;
      },
    },
    sha256: async (b) => createHash("sha256").update(b).digest("hex"),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    dataRoot: path.join(root, "data"),
    cacheRoot: path.join(root, "cache"),
  };
  await migrate(svc.db);
  return svc;
}

/** Tiny but real image files (valid magic bytes) with distinct content per seed. */
export function fakePng(seed: number): Uint8Array {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return new Uint8Array([...header, ...Array.from({ length: 64 }, (_, i) => (seed * 31 + i) % 256)]);
}

export function writeTemp(svc: { root: string }, name: string, bytes: Uint8Array): string {
  const dir = path.join(svc.root, "picked");
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
}
