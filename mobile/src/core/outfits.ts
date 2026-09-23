import { roleForCategory } from "@/lib/constants/vocab";
import type { ClothingItem, Outfit } from "@/lib/types";
import type { OutfitImport } from "@/lib/validation/outfit";
import { newOutfitId, randomToken } from "./ids";
import type { Db, Services } from "./services";

interface OutfitRow {
  id: string;
  name: string;
  description: string | null;
  occasion: string | null;
  season: string | null;
  style: string | null;
  explanation: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface OutfitItemRow {
  outfitId: string;
  clothingItemId: string;
  role: string;
  position: number;
}

/** Outfits with their item references; `item` summaries are resolved from the given items. */
export async function listOutfits(db: Db, items: ClothingItem[]): Promise<Outfit[]> {
  const [outfits, refs] = await Promise.all([
    db.all<OutfitRow>("SELECT id,name,description,occasion,season,style,explanation,source,createdAt,updatedAt FROM Outfit ORDER BY createdAt DESC"),
    db.all<OutfitItemRow>("SELECT outfitId, clothingItemId, role, position FROM OutfitItem ORDER BY position ASC"),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return outfits.map((o) => ({
    ...o,
    items: refs
      .filter((r) => r.outfitId === o.id)
      .map((r) => {
        const it = byId.get(r.clothingItemId);
        return {
          clothingItemId: r.clothingItemId,
          role: r.role,
          position: r.position,
          item: it
            ? { id: it.id, name: it.name, category: it.category, subcategory: it.subcategory, primaryColor: it.primaryColor, tags: it.tags, imageHash: it.imageHash, hasImage: Boolean(it.imagePath) }
            : null,
        };
      }),
  }));
}

/** Callers must have validated references (lib/outfits/parse-outfit.ts). */
export async function createOutfit(svc: Services, data: OutfitImport, opts: { source: string; raw?: unknown }): Promise<string> {
  const id = newOutfitId(svc);
  const now = new Date().toISOString();
  await svc.db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO Outfit (id,name,description,occasion,season,style,explanation,source,rawImport,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [id, data.name, data.description, data.occasion, data.season, data.style, data.explanation, opts.source, opts.raw === undefined ? null : JSON.stringify(opts.raw, null, 2), now, now],
    );
    for (const [position, ref] of data.items.entries()) {
      await tx.run("INSERT INTO OutfitItem (id,outfitId,clothingItemId,role,position) VALUES (?,?,?,?,?)", [
        `oi_${randomToken(svc, 12)}`,
        id,
        ref.clothingItemId,
        ref.role,
        position,
      ]);
    }
  });
  return id;
}

export async function deleteOutfit(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM OutfitItem WHERE outfitId = ?", [id]);
    await tx.run("DELETE FROM Outfit WHERE id = ?", [id]);
  });
}

/** Role an item plays by default when you build an outfit by hand. */
export const defaultRole = (category: string) => roleForCategory(category) ?? "ACCESSORY";
