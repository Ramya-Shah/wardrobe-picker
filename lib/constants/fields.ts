import type { EditableField } from "@/lib/types";

export type FieldKind = "text" | "textarea" | "list" | "category" | "subcategory" | "formality" | "pairing";

export interface FieldDefinition {
  key: EditableField;
  label: string;
  kind: FieldKind;
  group: "basics" | "colors" | "appearance" | "construction" | "style" | "context" | "search" | "pairing" | "notes";
  /** Path used in the Claude import schema — also accepted in `inferredFields`. */
  claudePath: string;
}

export const FIELD_DEFINITIONS: readonly FieldDefinition[] = [
  { key: "name", label: "Name", kind: "text", group: "basics", claudePath: "name" },
  { key: "category", label: "Category", kind: "category", group: "basics", claudePath: "category" },
  { key: "subcategory", label: "Subcategory", kind: "subcategory", group: "basics", claudePath: "subcategory" },
  { key: "primaryColor", label: "Primary color", kind: "text", group: "colors", claudePath: "colors.primary" },
  { key: "secondaryColors", label: "Secondary colors", kind: "list", group: "colors", claudePath: "colors.secondary" },
  { key: "pattern", label: "Pattern", kind: "text", group: "appearance", claudePath: "appearance.pattern" },
  { key: "texture", label: "Texture", kind: "text", group: "appearance", claudePath: "appearance.texture" },
  { key: "graphic", label: "Graphic", kind: "text", group: "appearance", claudePath: "appearance.graphic" },
  { key: "logo", label: "Logo", kind: "text", group: "appearance", claudePath: "appearance.logo" },
  { key: "material", label: "Material", kind: "text", group: "construction", claudePath: "construction.material" },
  { key: "fit", label: "Fit", kind: "text", group: "construction", claudePath: "construction.fit" },
  { key: "sleeveType", label: "Sleeves", kind: "text", group: "construction", claudePath: "construction.sleeveType" },
  { key: "neckline", label: "Neckline", kind: "text", group: "construction", claudePath: "construction.neckline" },
  { key: "length", label: "Length", kind: "text", group: "construction", claudePath: "construction.length" },
  { key: "silhouette", label: "Silhouette", kind: "text", group: "construction", claudePath: "construction.silhouette" },
  { key: "styles", label: "Style", kind: "list", group: "style", claudePath: "style" },
  { key: "formality", label: "Formality", kind: "formality", group: "style", claudePath: "formality" },
  { key: "seasons", label: "Seasons", kind: "list", group: "context", claudePath: "seasons" },
  { key: "occasions", label: "Occasions", kind: "list", group: "context", claudePath: "occasions" },
  { key: "environments", label: "Environments", kind: "list", group: "context", claudePath: "environments" },
  { key: "tags", label: "Tags", kind: "list", group: "search", claudePath: "tags" },
  { key: "description", label: "Description", kind: "textarea", group: "search", claudePath: "description" },
  { key: "pairingSuggestions", label: "Pairing suggestions", kind: "pairing", group: "pairing", claudePath: "pairingSuggestions" },
  { key: "userNotes", label: "My notes", kind: "textarea", group: "notes", claudePath: "notes" },
];

export const EDITABLE_FIELDS: readonly EditableField[] = FIELD_DEFINITIONS.map((f) => f.key);

export const FIELD_BY_KEY = Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.key, f])) as Record<
  EditableField,
  FieldDefinition
>;

const FIELD_BY_CLAUDE_PATH = new Map<string, EditableField>();
for (const f of FIELD_DEFINITIONS) {
  FIELD_BY_CLAUDE_PATH.set(f.claudePath.toLowerCase(), f.key);
  FIELD_BY_CLAUDE_PATH.set(f.key.toLowerCase(), f.key);
  const leaf = f.claudePath.split(".").pop();
  if (leaf && !FIELD_BY_CLAUDE_PATH.has(leaf.toLowerCase())) FIELD_BY_CLAUDE_PATH.set(leaf.toLowerCase(), f.key);
}
FIELD_BY_CLAUDE_PATH.set("styles", "styles");
FIELD_BY_CLAUDE_PATH.set("colors", "primaryColor");

/** Map "construction.material" / "material" / "style" → the app field name, or null if unknown. */
export function fieldFromClaudePath(path: string): EditableField | null {
  return FIELD_BY_CLAUDE_PATH.get(path.trim().toLowerCase()) ?? null;
}
