import { route } from "@/lib/api/http";
import { listAllItems } from "@/lib/db/clothing";
import { backupFilename } from "@/lib/backup/backup";
import { CLAUDE_SCHEMA_VERSION, inputToClaudeItem } from "@/lib/validation/clothing";

export const dynamic = "force-dynamic";

/**
 * Human-readable wardrobe export in the same schema Claude uses for imports
 * (plus each item's id). Pair it with the images export to move data anywhere.
 */
export const GET = route(async () => {
  const items = await listAllItems();
  const doc = {
    schemaVersion: CLAUDE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: item.id,
      ...inputToClaudeItem(item, { image: item.imagePath, inferredFields: item.inferredFields }),
      source: item.source,
      editedFields: item.editedFields,
      createdAt: item.createdAt,
    })),
  };
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${backupFilename("items", "json")}"`,
    },
  });
});
