import Link from "next/link";
import { ClothingImage } from "@/components/clothing/clothing-image";
import type { ClothingItemSummary } from "@/lib/types";

/** Horizontal, swipeable strip of recently added items. */
export function RecentStrip({ items }: { items: ClothingItemSummary[] }) {
  if (items.length === 0) return null;
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {items.map((item) => (
        <Link key={item.id} href={`/wardrobe/${item.id}`} className="w-28 shrink-0 snap-start active:opacity-80">
          <div className="aspect-[3/4] overflow-hidden rounded-xl">
            <ClothingImage id={item.id} hash={item.imageHash} hasImage={item.hasImage} alt={item.name} className="size-full" />
          </div>
          <p className="mt-1.5 line-clamp-1 text-xs">{item.name}</p>
        </Link>
      ))}
    </div>
  );
}
