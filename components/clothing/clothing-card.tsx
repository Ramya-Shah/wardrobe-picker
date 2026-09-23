import Link from "next/link";
import { Check } from "lucide-react";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import type { ClothingItemSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClothingImage } from "./clothing-image";

/** Grid card: the photo is the hero, metadata stays quiet underneath. */
export function ClothingCard({
  item,
  href,
  selectable = false,
  selected = false,
  onSelect,
  priority = false,
  footer,
}: {
  item: ClothingItemSummary;
  href?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  priority?: boolean;
  footer?: React.ReactNode;
}) {
  const meta = [categoryLabel(item.category), humanize(item.primaryColor)].filter(Boolean).join(" · ");
  const body = (
    <>
      <div className={cn("relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted", selected && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
        <ClothingImage id={item.id} hash={item.imageHash} hasImage={item.hasImage} alt={item.name} priority={priority} className="size-full" />
        {selectable && (
          <span
            className={cn(
              "absolute right-2 top-2 flex size-7 items-center justify-center rounded-full border-2 shadow-sm",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-white/90 bg-black/15",
            )}
            aria-hidden
          >
            {selected && <Check className="size-4" />}
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2">
        <p className="line-clamp-1 text-[14px] font-medium leading-5">{item.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{meta}</p>
        {item.tags.length > 0 && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">{item.tags.slice(0, 2).map((t) => `#${t}`).join("  ")}</p>
        )}
        {footer}
      </div>
    </>
  );

  if (selectable) {
    return (
      <button type="button" onClick={() => onSelect?.(item.id)} aria-pressed={selected} className="block w-full text-left">
        {body}
      </button>
    );
  }
  return (
    <Link href={href ?? `/wardrobe/${item.id}`} className="block active:opacity-80">
      {body}
    </Link>
  );
}

export function ClothingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
