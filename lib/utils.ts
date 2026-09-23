import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** URL of an item's photo. The hash makes the URL change when the photo is replaced (cache-busting). */
export function imageUrl(id: string, hash: string | null | undefined, size: "thumb" | "full" = "thumb"): string {
  return `/api/images/${encodeURIComponent(id)}?size=${size}${hash ? `&v=${hash.slice(0, 12)}` : ""}`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
