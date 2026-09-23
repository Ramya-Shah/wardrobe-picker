import type { ClothingItem } from "@/lib/types";

const COLUMNS: { header: string; get: (i: ClothingItem) => string | number | boolean | null }[] = [
  { header: "id", get: (i) => i.id },
  { header: "name", get: (i) => i.name },
  { header: "category", get: (i) => i.category },
  { header: "subcategory", get: (i) => i.subcategory },
  { header: "primaryColor", get: (i) => i.primaryColor },
  { header: "secondaryColors", get: (i) => i.secondaryColors.join("; ") },
  { header: "pattern", get: (i) => i.pattern },
  { header: "texture", get: (i) => i.texture },
  { header: "graphic", get: (i) => i.graphic },
  { header: "logo", get: (i) => i.logo },
  { header: "material", get: (i) => i.material },
  { header: "fit", get: (i) => i.fit },
  { header: "sleeveType", get: (i) => i.sleeveType },
  { header: "neckline", get: (i) => i.neckline },
  { header: "length", get: (i) => i.length },
  { header: "silhouette", get: (i) => i.silhouette },
  { header: "styles", get: (i) => i.styles.join("; ") },
  { header: "formality", get: (i) => i.formality },
  { header: "seasons", get: (i) => i.seasons.join("; ") },
  { header: "occasions", get: (i) => i.occasions.join("; ") },
  { header: "environments", get: (i) => i.environments.join("; ") },
  { header: "tags", get: (i) => i.tags.join("; ") },
  { header: "description", get: (i) => i.description },
  { header: "userNotes", get: (i) => i.userNotes },
  { header: "image", get: (i) => i.imagePath },
  { header: "originalFilename", get: (i) => i.originalFilename },
  { header: "source", get: (i) => i.source },
  { header: "aiGenerated", get: (i) => i.aiGenerated },
  { header: "userEdited", get: (i) => i.userEdited },
  { header: "editedFields", get: (i) => i.editedFields.join("; ") },
  { header: "createdAt", get: (i) => i.createdAt },
];

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function itemsToCsv(items: ClothingItem[]): string {
  const rows = [COLUMNS.map((c) => c.header).join(",")];
  for (const item of items) rows.push(COLUMNS.map((c) => csvCell(c.get(item))).join(","));
  return rows.join("\r\n") + "\r\n";
}
