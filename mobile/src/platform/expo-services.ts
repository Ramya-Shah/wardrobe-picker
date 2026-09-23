import * as Crypto from "expo-crypto";
import { Directory, File, FileMode, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as SQLite from "expo-sqlite";
import { migrate } from "~/core/schema";
import { joinPath, type Db, type FileStore, type ImageTools, type Services, type SqlValue } from "~/core/services";

/** Wraps an expo-sqlite connection in the core's Db interface. */
function wrapDb(conn: SQLite.SQLiteDatabase, inTransaction = false): Db {
  const db: Db = {
    async exec(sql) {
      await conn.execAsync(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = await conn.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => conn.getAllAsync<T>(sql, params),
    first: <T,>(sql: string, params: SqlValue[] = []) => conn.getFirstAsync<T>(sql, params),
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (inTransaction) return fn(db);
      let result: T;
      // Exclusive: other queries can't interleave with the transaction's statements.
      await conn.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrapDb(txn, true));
      });
      return result!;
    },
  };
  return db;
}

const files: FileStore = {
  readBytes: (p) => new File(p).bytes(),
  readText: (p) => new File(p).text(),
  async writeBytes(p, data) {
    const f = new File(p);
    if (!f.exists) f.create({ intermediates: true });
    f.write(data);
  },
  async writeText(p, text) {
    const f = new File(p);
    if (!f.exists) f.create({ intermediates: true });
    f.write(text);
  },
  async exists(p) {
    return Paths.info(p).exists;
  },
  async size(p) {
    return new File(p).size ?? 0;
  },
  async remove(p) {
    const f = new File(p);
    if (f.exists) f.delete();
  },
  async removeDir(p) {
    const d = new Directory(p);
    if (d.exists) d.delete();
  },
  async ensureDir(p) {
    new Directory(p).create({ intermediates: true, idempotent: true });
  },
  async list(p) {
    const d = new Directory(p);
    return d.exists ? d.list().map((e) => e.name) : [];
  },
  async move(from, to) {
    await new File(from).move(new File(to), { overwrite: true });
  },
  async copy(from, to) {
    await new File(from).copy(new File(to), { overwrite: true });
  },
  openWriter(p) {
    const f = new File(p);
    if (f.exists) f.delete();
    f.create({ intermediates: true });
    const handle = f.open(FileMode.WriteOnly);
    return { write: (b) => handle.writeBytes(b), close: () => handle.close() };
  },
  openReader(p) {
    const f = new File(p);
    const size = f.size ?? 0;
    const handle = f.open(FileMode.ReadOnly);
    return { size, read: (n) => handle.readBytes(n), close: () => handle.close() };
  },
};

const images: ImageTools = {
  async makeThumbnail(source, target, width) {
    const original = await ImageManipulator.manipulate(source).renderAsync();
    const dims = { width: original.width, height: original.height };
    const thumb = await ImageManipulator.manipulate(source)
      .resize({ width: Math.min(width, original.width) })
      .renderAsync();
    const saved = await thumb.saveAsync({ format: SaveFormat.WEBP, compress: 0.75 });
    await files.move(saved.uri, target);
    return dims;
  },
  async convertToJpeg(source, target) {
    const ref = await ImageManipulator.manipulate(source).renderAsync();
    const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
    await files.move(saved.uri, target);
    return true;
  },
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Open the on-device database, apply migrations, and wire up files/images/crypto. */
export async function createExpoServices(): Promise<Services> {
  const conn = await SQLite.openDatabaseAsync("wardrobe.db");
  await conn.execAsync("PRAGMA journal_mode = WAL;");
  const db = wrapDb(conn);
  await migrate(db);
  const svc: Services = {
    db,
    files,
    images,
    sha256: async (bytes) => toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes))),
    randomBytes: (n) => Crypto.getRandomBytes(n),
    dataRoot: joinPath(Paths.document.uri, "wardrobe"),
    cacheRoot: joinPath(Paths.cache.uri, "wardrobe"),
  };
  await files.ensureDir(svc.dataRoot);
  await files.ensureDir(svc.cacheRoot);
  return svc;
}
