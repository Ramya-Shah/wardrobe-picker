"use client";

import { useState } from "react";
import { Shirt } from "lucide-react";
import { cn, imageUrl } from "@/lib/utils";

/**
 * Clothing photo served by /api/images. Thumbnails by default (≈480px WebP) so grids of
 * hundreds of items stay light; lazy-loaded unless `priority`.
 */
export function ClothingImage({
  id,
  hash,
  hasImage = true,
  alt,
  size = "thumb",
  priority = false,
  className,
  fit = "cover",
}: {
  id: string;
  hash: string | null | undefined;
  hasImage?: boolean;
  alt: string;
  size?: "thumb" | "full";
  priority?: boolean;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  if (!hasImage || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)} role="img" aria-label={alt}>
        <Shirt className="size-8 opacity-40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local API images; thumbnails are pre-sized server-side
    <img
      src={imageUrl(id, hash, size)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
      className={cn("bg-muted", fit === "cover" ? "object-cover" : "object-contain", className)}
      draggable={false}
    />
  );
}
