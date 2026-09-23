import { route } from "@/lib/api/http";
import { listAllItems } from "@/lib/db/clothing";
import { backupFilename } from "@/lib/backup/backup";
import { itemsToCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const csv = itemsToCsv(await listAllItems());
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${backupFilename("items", "csv")}"`,
    },
  });
});
