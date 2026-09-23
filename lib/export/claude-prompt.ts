import { CATEGORIES, SUBCATEGORIES } from "@/lib/constants/categories";
import { COMMON_OCCASIONS, COMMON_STYLES, ENVIRONMENTS, FORMALITY_LEVELS, OUTFIT_ROLES, SEASONS } from "@/lib/constants/vocab";
import { CLAUDE_SCHEMA_VERSION } from "@/lib/validation/clothing";

/**
 * The prompt given to Claude Chat together with clothing photos.
 *
 * Single source of truth: docs/CLAUDE_WARDROBE_PROMPT.md is generated from this file
 * (`npm run docs:prompt`) and a test fails if they drift apart. The schema described here
 * is exactly what lib/validation/clothing.ts accepts.
 */

export const EXAMPLE_ITEM = {
  image: "IMG_4821.jpg",
  name: "Cream Brown Striped Overshirt",
  category: "TOP",
  subcategory: "overshirt",
  colors: { primary: "cream", secondary: ["brown"] },
  appearance: { pattern: "vertical stripes", texture: "smooth woven", graphic: null, logo: "none" },
  construction: {
    material: "likely cotton",
    fit: "oversized",
    sleeveType: "full sleeve",
    neckline: "collar",
    length: "hip length",
    silhouette: "relaxed",
  },
  style: ["casual", "streetwear"],
  formality: "casual",
  seasons: ["spring", "summer", "autumn"],
  occasions: ["college", "casual", "travel", "dinner"],
  environments: ["indoor", "outdoor"],
  tags: ["striped", "oversized", "neutral", "full-sleeve", "button-up", "layering"],
  description:
    "Relaxed-fit cream overshirt with thin brown vertical stripes, a classic point collar and a full button placket. Works open as a light layer over a tee or buttoned up on its own.",
  pairingSuggestions: {
    tops: ["white t-shirt", "black t-shirt"],
    bottoms: ["black jeans", "blue jeans", "beige trousers"],
    dresses: [],
    outerwear: [],
    shoes: ["white sneakers", "brown loafers"],
    accessories: ["brown leather belt"],
  },
  inferredFields: ["construction.material", "seasons", "occasions", "style", "formality"],
};

const subcategoryLines = CATEGORIES.map((c) => `  - ${c}: ${SUBCATEGORIES[c].join(", ")}`).join("\n");

export const WARDROBE_PROMPT = `You are cataloguing my clothes for my personal wardrobe app. I have attached photos of clothing items. Analyse every photo and return structured JSON that the app can import directly.

# Output format

Return ONLY valid JSON — no markdown fences, no commentary before or after. Use exactly this top-level shape, even for a single photo:

{
  "schemaVersion": ${CLAUDE_SCHEMA_VERSION},
  "items": [ { ...one object per clothing item... } ]
}

Each item must follow this schema (this is a complete, valid example):

${JSON.stringify(EXAMPLE_ITEM, null, 2)}

# The "image" field (critical)

- "image" links the metadata to the photo. Set it to the exact filename of the photo, including the extension, with the same spelling and capitalisation (e.g. "IMG_4821.jpg").
- If I listed the filenames in my message, use those names. If you can see attachment names, use them.
- Never invent or guess a filename. If you truly cannot tell which filename a photo has, set "image": null — the app will ask me to assign it.
- One item per photo. If one photo clearly shows several separate garments (e.g. a flat-lay), describe only the main item unless I ask otherwise.
- Every item must have a different "image".

# Field rules

- name: short, specific, human name: colour + key detail + type, e.g. "Black Relaxed Fit Jeans", "White Low-Top Leather Sneakers".
- category: one of ${CATEGORIES.join(", ")}.
- subcategory: lower_snake_case. Prefer these, but use a new value if none fits:
${subcategoryLines}
- colors.primary: the dominant colour as a plain word ("black", "navy", "cream", "olive"…). colors.secondary: other clearly visible colours (can be []).
- appearance.pattern: "solid", "vertical stripes", "checked", "floral", "graphic print"… appearance.texture: visible surface ("ribbed knit", "smooth", "distressed denim"…).
- appearance.graphic: describe any printed graphic or text, or null if there is none. appearance.logo: describe a visible logo, "none" if clearly no logo, null if you can't tell.
- construction: material, fit, sleeveType, neckline, length, silhouette. Use null for anything that does not apply (e.g. neckline for shoes) or that you cannot determine.
- style: 1–4 style words. Suggested: ${COMMON_STYLES.join(", ")}.
- formality: one of ${FORMALITY_LEVELS.join(", ")}.
- seasons: from ${SEASONS.join(", ")}.
- occasions: realistic uses. Suggested: ${COMMON_OCCASIONS.join(", ")}.
- environments: from ${ENVIRONMENTS.join(", ")}.
- tags: 4–10 lowercase search keywords someone might type to find this item (colours, pattern, fit, details like "button-up", "cropped", "high-waisted", "chunky sole").
- description: 1–3 sentences, rich and specific: what it looks like, notable details, how it could be worn. This powers search, so include useful words.
- pairingSuggestions: generic items that would pair well, grouped by tops, bottoms, dresses, outerwear, shoes, accessories. Describe them simply ("black jeans", "white sneakers") — they do not need to be in my wardrobe. Use [] for groups that don't apply.
- inferredFields: list the fields that are your inference rather than directly visible, using the paths from the schema (e.g. "construction.material", "seasons", "occasions", "style", "formality").

# Accuracy: visible facts vs. inferences

- Visible facts (colour, pattern, sleeve length, collar, visible logo, silhouette) should be stated plainly.
- Inferences (material, suitable seasons/occasions, style labels, formality) are fine and useful, but mark them in inferredFields, and hedge uncertain values in the text itself (e.g. "likely cotton", "possibly linen blend").
- Never invent brands, sizes, prices or details you cannot see. Use null when you don't know. Do not guess a brand from a logo you can't read.
- Colours: describe what you see; avoid over-precise shades unless obvious.

# Final check before answering

- The response parses as JSON (double quotes, no trailing commas, no comments).
- Every item has "image" and "name"; every category is one of the allowed values.
- There is exactly one item per photo, and the number of items equals the number of photos.
`;

export const OUTFIT_PROMPT_NOTE = `When the app sends you "MY WARDROBE" context and asks for an outfit, reply with JSON only:

{
  "name": "Casual Dinner",
  "occasion": "casual dinner",
  "season": "summer",
  "style": "minimal",
  "items": [
    { "clothingItemId": "itm_xxxxxxxx", "role": "TOP" },
    { "clothingItemId": "itm_yyyyyyyy", "role": "BOTTOM" },
    { "clothingItemId": "itm_zzzzzzzz", "role": "SHOES" }
  ],
  "explanation": "Why these pieces work together."
}

- Roles: ${OUTFIT_ROLES.join(", ")}.
- Only use clothingItemId values that appear in the provided wardrobe context. The app rejects outfits with unknown IDs.
- For alternatives, return {"outfits": [ ... ]}.`;

/** The filename list to paste under the prompt, e.g. "Photo filenames: a.jpg, b.jpg". */
export function filenameListMessage(filenames: string[]): string {
  return `Photo filenames (${filenames.length}): ${filenames.join(", ")}`;
}

export function renderPromptMarkdown(): string {
  return `<!-- Generated from lib/export/claude-prompt.ts by \`npm run docs:prompt\`. Do not edit by hand. -->

# Claude wardrobe prompt

Copy everything inside the box below into Claude Chat and attach your clothing photos
(works for 1 photo or 50+). Claude replies with JSON — import it in the app under
**Import from Claude**. The app validates exactly this schema (version ${CLAUDE_SCHEMA_VERSION}).

**Tip — filenames:** Claude links each item to a photo by filename. To be safe, add one
line after the prompt listing the filenames, e.g.
\`Photo filenames (3): IMG_4821.jpg, IMG_4822.jpg, IMG_4830.jpg\`.
The app's **Import → Claude prompt** screen can build that line for you from the photos you select.

For large wardrobes, send photos in batches of ~20 per message and import each JSON reply
(or merge the \`items\` arrays into one file).

---

\`\`\`text
${WARDROBE_PROMPT}\`\`\`

---

## Outfits

Outfit requests are generated inside the app (Outfits → Outfit picker → *Copy for Claude*);
they already include the rules and your wardrobe context. For reference, Claude must answer with:

\`\`\`text
${OUTFIT_PROMPT_NOTE}
\`\`\`

Paste Claude's answer into **Outfits → Import outfit**.
`;
}
