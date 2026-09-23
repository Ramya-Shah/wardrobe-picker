import { prisma } from "./client";
import { newOutfitId } from "./ids";
import { rowToItem, toSummary } from "./mappers";
import type { Outfit } from "@/lib/types";
import type { OutfitImport } from "@/lib/validation/outfit";
import type { Prisma } from "@prisma/client";

const include = {
  items: { include: { clothingItem: { omit: { rawImport: true } } }, orderBy: { position: "asc" } },
} satisfies Prisma.OutfitInclude;

type OutfitRow = Prisma.OutfitGetPayload<{ include: typeof include }>;

function toOutfit(row: OutfitRow): Outfit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    occasion: row.occasion,
    season: row.season,
    style: row.style,
    explanation: row.explanation,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((oi) => ({
      clothingItemId: oi.clothingItemId,
      role: oi.role,
      position: oi.position,
      item: oi.clothingItem ? toSummary(rowToItem({ ...oi.clothingItem, rawImport: null })) : null,
    })),
  };
}

export async function listOutfits(): Promise<Outfit[]> {
  const rows = await prisma.outfit.findMany({ include, orderBy: { createdAt: "desc" } });
  return rows.map(toOutfit);
}

export async function getOutfit(id: string): Promise<Outfit | null> {
  const row = await prisma.outfit.findUnique({ where: { id }, include });
  return row ? toOutfit(row) : null;
}

export async function countOutfits(): Promise<number> {
  return prisma.outfit.count();
}

/** Create an outfit. Callers must have validated references (see lib/outfits/parse-outfit.ts). */
export async function createOutfit(data: OutfitImport, opts: { source: string; raw?: unknown }): Promise<Outfit> {
  const id = newOutfitId();
  const row = await prisma.outfit.create({
    data: {
      id,
      name: data.name,
      description: data.description,
      occasion: data.occasion,
      season: data.season,
      style: data.style,
      explanation: data.explanation,
      source: opts.source,
      rawImport: opts.raw === undefined ? null : JSON.stringify(opts.raw, null, 2),
      items: {
        create: data.items.map((ref, position) => ({ clothingItemId: ref.clothingItemId, role: ref.role, position })),
      },
    },
    include,
  });
  return toOutfit(row);
}

export async function deleteOutfit(id: string): Promise<boolean> {
  const res = await prisma.outfit.deleteMany({ where: { id } });
  return res.count > 0;
}

export async function outfitsForItem(itemId: string): Promise<Outfit[]> {
  const rows = await prisma.outfit.findMany({
    where: { items: { some: { clothingItemId: itemId } } },
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toOutfit);
}
