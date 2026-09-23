import { route } from "@/lib/api/http";
import { backupFilename, createBackupStream } from "@/lib/backup/backup";

export const dynamic = "force-dynamic";

/** GET /api/backup → wardrobe-backup-<date>.zip (database.json + images/). ?type=images → photos only. */
export const GET = route(async (request) => {
  const type = new URL(request.url).searchParams.get("type") === "images" ? "images" : "full";
  return new Response(createBackupStream(type), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${backupFilename(type === "images" ? "images" : "backup", "zip")}"`,
      "cache-control": "no-store",
    },
  });
});
