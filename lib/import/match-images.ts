/**
 * Associate imported metadata with uploaded image files **by filename**, never by order.
 *
 * Matching precedence for each item's `image` reference:
 *   1. exact filename
 *   2. case-insensitive filename
 *   3. filename without extension (e.g. "IMG_001" ↔ "IMG_001.JPG"), only if unambiguous
 * A file can be matched to at most one item.
 */

export type MatchKind = "exact" | "case-insensitive" | "stem";

export interface ImageMatch {
  itemIndex: number;
  reference: string | null;
  filename: string | null;
  kind: MatchKind | null;
  error: string | null;
}

export interface MatchResult {
  matches: ImageMatch[];
  unusedFiles: string[];
}

/** Strip directories (both / and \) from a reference like "photos/IMG_1.jpg". */
export function baseName(ref: string): string {
  const parts = ref.trim().split(/[\\/]/);
  return parts[parts.length - 1] ?? "";
}

export function stem(filename: string): string {
  const b = baseName(filename);
  const dot = b.lastIndexOf(".");
  return (dot > 0 ? b.slice(0, dot) : b).toLowerCase();
}

export function matchImagesToItems(
  items: { index: number; image: string | null }[],
  filenames: string[],
): MatchResult {
  const available = new Set(filenames);
  const matches: ImageMatch[] = [];

  const take = (name: string) => {
    available.delete(name);
    return name;
  };

  for (const item of items) {
    if (!item.image) {
      matches.push({ itemIndex: item.index, reference: null, filename: null, kind: null, error: 'Missing "image" filename in the JSON.' });
      continue;
    }
    const ref = baseName(item.image);
    const pool = [...available];

    const exact = pool.find((f) => f === ref);
    if (exact) {
      matches.push({ itemIndex: item.index, reference: item.image, filename: take(exact), kind: "exact", error: null });
      continue;
    }
    const ci = pool.filter((f) => f.toLowerCase() === ref.toLowerCase());
    if (ci.length === 1) {
      matches.push({ itemIndex: item.index, reference: item.image, filename: take(ci[0]), kind: "case-insensitive", error: null });
      continue;
    }
    const byStem = pool.filter((f) => stem(f) === stem(ref));
    if (byStem.length === 1) {
      matches.push({ itemIndex: item.index, reference: item.image, filename: take(byStem[0]), kind: "stem", error: null });
      continue;
    }
    matches.push({
      itemIndex: item.index,
      reference: item.image,
      filename: null,
      kind: null,
      error:
        byStem.length > 1 || ci.length > 1
          ? `"${item.image}" matches several uploaded files — rename them so each is unique.`
          : filenames.some((f) => f.toLowerCase() === ref.toLowerCase() || stem(f) === stem(ref))
            ? `"${item.image}" is already used by another item.`
            : `No uploaded image named "${item.image}".`,
    });
  }

  return { matches, unusedFiles: filenames.filter((f) => available.has(f)) };
}
