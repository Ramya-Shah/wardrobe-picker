import Link from "next/link";
import { ClothingImage } from "@/components/clothing/clothing-image";
import { humanize } from "@/lib/constants/categories";
import type { Outfit } from "@/lib/types";

/** Outfit tile: a 2×2 collage of the actual clothing photos. */
export function OutfitCard({ outfit }: { outfit: Outfit }) {
  const pieces = outfit.items.filter((i) => i.item).slice(0, 4);
  return (
    <Link href={`/outfits/${outfit.id}`} className="block active:opacity-80">
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-muted">
        {pieces.map((p, idx) => (
          <div key={p.clothingItemId} className={pieces.length === 1 ? "col-span-2 row-span-2" : pieces.length === 3 && idx === 0 ? "row-span-2" : pieces.length === 2 ? "row-span-2" : ""}>
            <ClothingImage id={p.item!.id} hash={p.item!.imageHash} hasImage={p.item!.hasImage} alt={p.item!.name} className="size-full" />
          </div>
        ))}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium">{outfit.name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">
        {[humanize(outfit.occasion), `${outfit.items.length} pieces`].filter(Boolean).join(" · ")}
      </p>
    </Link>
  );
}
