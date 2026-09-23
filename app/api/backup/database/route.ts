import { route } from "@/lib/api/http";
import { backupFilename, snapshotDatabase } from "@/lib/backup/backup";

export const dynamic = "force-dynamic";

/** Raw SQLite snapshot (consistent copy via VACUUM INTO). */
export const GET = route(async () => {
  const data = await snapshotDatabase();
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "application/vnd.sqlite3",
      "content-disposition": `attachment; filename="${backupFilename("database", "db")}"`,
      "cache-control": "no-store",
    },
  });
});
