import Link from "next/link";
import { ClothingImage } from "@/components/clothing/clothing-image";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { OUTFIT_ROLE_LABELS, OUTFIT_ROLES, type OutfitRole } from "@/lib/constants/vocab";
import type { ClothingItemSummary } from "@/lib/types";

const ORDER = new Map(OUTFIT_ROLES.map((r, i) => [r, i]));

/** The actual clothing photos of an outfit, ordered top-to-toe. */
export function OutfitPieces({ pieces }: { pieces: { role: string; clothingItemId: string; item: ClothingItemSummary | null }[] }) {
  const sorted = [...pieces].sort((a, b) => (ORDER.get(a.role as OutfitRole) ?? 9) - (ORDER.get(b.role as OutfitRole) ?? 9));
  return (
    <div className="grid grid-cols-2 gap-3">
      {sorted.map((p) => (
        <div key={p.clothingItemId}>
          {p.item ? (
            <Link href={`/wardrobe/${p.item.id}`} className="block active:opacity-80">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl">
                <ClothingImage id={p.item.id} hash={p.item.imageHash} hasImage={p.item.hasImage} alt={p.item.name} className="size-full" />
              </div>
              <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{OUTFIT_ROLE_LABELS[p.role as OutfitRole] ?? humanize(p.role)}</p>
              <p className="line-clamp-1 text-sm">{p.item.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{[categoryLabel(p.item.category), humanize(p.item.primaryColor)].filter(Boolean).join(" · ")}</p>
            </Link>
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-muted p-3 text-center text-xs text-muted-foreground">
              Missing item {p.clothingItemId}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
