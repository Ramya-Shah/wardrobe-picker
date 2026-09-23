# Wardrobe — a local-first digital wardrobe

A personal wardrobe app you use from your phone's browser (or as an installed PWA) while it runs on your own computer. It stores photos of your clothes plus rich metadata, lets you browse, search, filter and edit everything, and builds outfits.

There are two versions, sharing the same core code and data formats:

- **Web app** (this folder): runs on your computer; you open it from your phone's browser over Wi-Fi.
- **Android app** ([`mobile/`](mobile/README.md), Expo): runs **fully offline on the phone** — database and photos stored on the device. Backups move between the two.

**Claude is the AI, but the app never calls it.** You chat with Claude yourself: Claude looks at your photos and returns JSON in the schema this app defines; you import that JSON. For outfits, the app exports your wardrobe as text for Claude, and you import Claude's outfit JSON. No API keys, accounts, cloud database or cloud storage. Browsing works without internet.

---

## Contents

- [Quick start](#quick-start)
- [Opening it on your phone (same Wi-Fi)](#opening-it-on-your-phone-same-wi-fi)
- [The Claude workflow](#the-claude-workflow)
- [Features](#features)
- [Backups and data portability](#backups-and-data-portability)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Development](#development)
- [Roadmap](#roadmap)

---

## Quick start

Requirements: **Node.js 20.9+** (22 LTS recommended) and npm.

```bash
npm install        # installs dependencies and generates the Prisma client
npm run setup      # creates data/wardrobe.db and applies the migrations
npm run build
npm start          # production server on port 3000, reachable from your phone
```

Open <http://localhost:3000> on the computer. `npm start` also prints the address to use from your phone.

For development with hot reload use `npm run dev` instead of `build` + `start`. For daily phone use, `npm start` is faster.

The database is created automatically: `npm run setup`, `npm run dev` and `npm start` all run `prisma migrate deploy` first, which creates `data/wardrobe.db` if it doesn't exist.

## Opening it on your phone (same Wi-Fi)

`http://localhost:3000` **won't work on the phone**, because on the phone "localhost" means the phone itself. Use your computer's local network address instead:

1. Connect the computer and the phone to the **same Wi-Fi network**.
2. Start the app on the computer (`npm start` or `npm run dev`). It prints something like:
   ```
   • On your phone:     http://192.168.1.23:3000   (same Wi-Fi)
   ```
3. Open that address in Safari or Chrome on the phone.

If you need to find the IP yourself:

| OS | How |
| --- | --- |
| macOS | System Settings → Wi-Fi → Details → IP address, or run `ipconfig getifaddr en0` |
| Windows | `ipconfig` in a terminal → "IPv4 Address" of the Wi-Fi adapter |
| Linux | `hostname -I` or `ip -4 addr show` |

It's usually `192.168.x.x`, `10.x.x.x` or `172.16–31.x.x`.

If it doesn't load, check these:
- **Firewall.** Allow incoming connections for Node.js on port 3000. On macOS, click "Allow" when prompted. On Windows, allow Node.js on *Private* networks.
- **Guest or office Wi-Fi.** These often block devices from talking to each other ("client isolation"). Use your home network or a phone hotspot.
- **Changing IP.** The computer's IP can change after a reboot. Reserve it in your router, or use the `http://<computer-name>.local:3000` name on macOS.
- **Another port.** Use `PORT=4000 npm start`.

### Add to the home screen (PWA)

- **iPhone (Safari):** Share → *Add to Home Screen*. It opens full-screen without browser chrome.
- **Android (Chrome):** ⋮ → *Add to Home screen* / *Install app*.

Limits when you use the app over plain `http://192.168…`: browsers only enable **service workers** (offline caching) and the one-tap **install prompt** on HTTPS or `localhost`. The home-screen shortcut and full-screen display still work. The app also works around the other secure-context limits: copying to the clipboard uses a fallback, and hashing happens on the server. If you want full offline caching on the phone, run the dev server with HTTPS (`npx next dev -H 0.0.0.0 --experimental-https`) and trust the generated certificate on the phone.

## The Claude workflow

The contract between Claude and the app is **`docs/CLAUDE_WARDROBE_PROMPT.md`**. It is generated from the same TypeScript constants the validator uses (`lib/export/claude-prompt.ts`), and a test fails if they ever drift apart. You can also copy the prompt in the app: **Import from Claude → Prompt**.

### First import (for example 100 photos)

1. Copy the prompt into a new Claude chat and attach your photos. About 20 per message works well; repeat for the rest.
2. Optional but recommended: on **Import → Prompt**, pick the same photos. The app adds a line with their filenames to the prompt, so Claude can fill in the `image` field reliably.
3. Claude replies with JSON:
   ```json
   { "schemaVersion": 1, "items": [ { "image": "IMG_4821.jpg", "name": "…", … }, … ] }
   ```
   Save it as `wardrobe.json`, or keep it to paste.
4. In the app, open **Import from Claude → Batch**, choose all the photos, and choose `wardrobe.json` (or paste the JSON).
5. Tap **Validate & preview**. The photos are uploaded and checked (type, size, content, SHA-256 hash). Each item is matched to its photo **by filename, never by order**. Matching tries the exact name first, then ignores case, then ignores the extension (so iPhone `IMG_1.HEIC` → `IMG_1.jpeg` still matches).
6. The preview shows every item with its photo, name, category, colors, style and tags, plus:
   - **Errors:** invalid JSON fields, missing name, no matching photo. Fix the item with **Edit/Fix**, assign one of the unmatched photos, or **Exclude** it. Import stays disabled until nothing fails.
   - **Duplicates:** "This clothing image already exists." Choose **Skip**, **Replace metadata** or **Add anyway** for each one. Duplicates are never created silently.
7. Tap **Import all**. The import is all-or-nothing: images are written first, then one database transaction runs. If anything fails, nothing is kept.

Claude often wraps JSON in `` ```json `` fences or adds a sentence before it. The importer strips that.

### Adding one new item later

Take a photo, send it to Claude with the prompt, then open **Import from Claude → Single item**. Pick the photo, paste the JSON, preview, and confirm. You can also add an item entirely by hand with **Add clothing** (the + button).

### Creating an outfit with Claude

1. Open an item and tap **Outfit**, or go to **Outfits → Outfit picker**.
2. Set the occasion, style, season and required items (for example "casual dinner", "minimal", black jeans). The picker ranks candidates by role using occasions, styles, seasons and the required items' pairing suggestions.
3. Tap **Copy for Claude**. You get a complete prompt with the rules, the response schema and a compact context of real items **with their IDs**:
   ```
   CLOTHING ITEM: itm_7k3m9x2p
   Name: Cream Brown Striped Overshirt
   Category: TOP / overshirt
   Color: Cream, Brown
   Pattern: Vertical stripes
   …
   ```
4. Paste it into Claude. Claude answers with outfit JSON:
   ```json
   { "name": "Casual Dinner", "occasion": "casual dinner",
     "items": [ { "clothingItemId": "itm_…", "role": "TOP" }, … ],
     "explanation": "…" }
   ```
5. Open **Outfits → Import outfit** and paste the JSON. The app checks the structure, the roles (`TOP, BOTTOM, DRESS, OUTERWEAR, SHOES, ACCESSORY`) and **every clothing ID**. An outfit that references an ID not in your wardrobe is rejected. After a preview with the real photos, save it.

You can also save an outfit yourself from the picker (tap items, then **Save**). **Settings → Export items for Claude** copies any selection, or the whole wardrobe, as text or JSON for any other question you want to ask Claude.

### What Claude should (not) invent

The prompt makes Claude separate **visible facts** (color, pattern, sleeves, collar, a visible logo) from **inferences** (material, seasons, occasions, style, formality). Inferred fields are listed in `inferredFields` and shown with an "inferred" label in the app. Unknown values are `null` ("unknown" is also accepted and stored as null). Claude is told never to invent brands, sizes or details.

## Features

- **Wardrobe browser:** a mobile-first photo grid with category chips, a sticky search bar, a "Recently added" strip, quick actions, infinite scroll with thumbnails, and bottom navigation (Wardrobe, Search, Outfits, Settings).
- **Item detail:** a large photo, every attribute, the description, pairing suggestions, notes and the outfits the item appears in. Actions: Edit, Outfit, Duplicate, Delete (with an option to keep the photo file). The original Claude JSON is kept for auditing.
- **Editing with provenance:** every field is editable and the photo can be replaced. Fields you change are recorded in `editedFields` and marked "edited by you". A later **Replace metadata** import never overwrites them.
- **Search:** structured search over name, category, subcategory, colors, pattern, material, fit, style, season, occasion, formality, tags and description. Every word must match; matches in the name, category or color rank higher. It handles plurals and synonyms ("tee" finds t-shirts, "pants" finds trousers).
- **Filters:** category, type, color, pattern, style, fit, season, occasion, formality and material. Options within one filter are OR-ed; different filters are AND-ed. The filters live in the URL, so you can bookmark a search.
- **Unknown categories are fine:** categories and subcategories are plain strings. Known aliases are normalized ("tops" → `TOP`, "T-Shirt" → `tshirt`), and anything new is kept.
- **PWA:** manifest, icons (including maskable), standalone display, theme color, safe-area insets, and a service worker (on HTTPS or localhost).

## Backups and data portability

Everything lives in `data/`:

```
data/wardrobe.db            SQLite database (metadata only, no image blobs)
data/images/<id>.<ext>      original photos
data/images/thumbs/<id>.webp  generated thumbnails (can be rebuilt)
```

Go to **Settings → Export & backup**:

| Export | Contents |
| --- | --- |
| Full backup (`wardrobe-backup-….zip`) | `database.json` (all items and outfits, human-readable) + `images/` |
| Export wardrobe (JSON) | All items in the Claude schema, plus IDs |
| Export CSV | One row per item (with formula-injection protection) |
| Export photos (.zip) | Only the original images |
| Backup database (.db) | A consistent SQLite snapshot (`VACUUM INTO`) |

**Restore** (Settings → Restore / import wardrobe) accepts a backup zip or a bare `database.json`. It has two modes:
- **Add to wardrobe:** adds the items and outfits whose IDs aren't present yet.
- **Replace everything:** you must type `REPLACE` to confirm.

Restores are validated before anything is written, and photos are only moved into place after the database transaction succeeds.

Copying the whole `data/` folder is also a complete backup.

**Delete all wardrobe data** (Settings → Danger zone) requires typing `DELETE`.

## Architecture

- **Next.js 16 (App Router) + TypeScript.** Pages are server components that read SQLite directly. Interactive parts (browser, import wizard, forms) are client components that call JSON route handlers under `app/api/`.
- **Tailwind CSS v4 + shadcn/ui.** The components in `components/ui` follow the shadcn/ui conventions (Radix primitives, `cva`, `cn`). Native `<select>` is used on purpose, because the phone's own picker beats a custom dropdown.
- **Prisma + SQLite.** Models: `ClothingItem`, `Outfit`, `OutfitItem` (role, position; cascades when an item is deleted). Filterable scalars are real indexed columns. List-like and nested values (colors, styles, seasons, tags, pairing suggestions, provenance) are JSON-encoded text columns, handled in `lib/db/mappers.ts`. Each item also stores a normalized `searchText`.
- **Zod everywhere:** the Claude item schema, outfit schema, API bodies, PATCH payloads, backup documents. It is lenient about formatting (case, "unknown", a string instead of a list) and strict about structure.
- **Images:** checked by extension, MIME type **and magic bytes**, up to 25 MB, JPG/PNG/WebP only. Each photo is hashed with SHA-256 to detect duplicates, stored as `data/images/<id>.<ext>` via atomic writes, and gets a 480px WebP thumbnail made with `sharp`, respecting EXIF rotation. Images are served by `/api/images/:id`, which looks the file up **through the database**, so no path ever comes from the URL. Versioned URLs are cached immutably.
- **Import pipeline:** `session → stage (one photo per request, 3 in parallel, with progress) → preview → commit`. Staged files live in `data/staging/<session>/` and are cleaned up after 24 hours.
- **Search:** `lib/search/search.ts` pre-filters in SQLite (category index + `searchText LIKE`) and then runs the precise, pure `structured-search.ts`. `semantic-search.ts` defines a `SemanticSearchProvider` interface, disabled for now. Plugging in embeddings later needs no other changes: its scores are already blended in.
- **Security (even though it's local):** there's no login by design, so the API rejects cross-origin mutations (an Origin check). That stops another website open on the phone from sending requests to your wardrobe. The app also sanitizes filenames, validates IDs, guards against path traversal, never renders HTML from data (no `dangerouslySetInnerHTML`), sends `nosniff` and `X-Frame-Options` headers, and limits zip-bomb sizes on restore.
- **No AI dependencies** of any kind.

## Project structure

```
mobile/                    Android app (Expo) — see mobile/README.md
app/
  page.tsx                 home: My Wardrobe (stats, quick actions, recent, grid)
  wardrobe/                browser, [id] detail, [id]/edit, new (manual add)
  search/                  search + filters
  import/                  Import from Claude (single/batch), prompt/
  outfits/                 list, [id], picker/, import/
  export/                  export selected items for Claude
  settings/                storage, Claude, export/backup, restore, danger zone
  api/                     route handlers (items, images, import, outfits, export, backup, admin)
  manifest.ts              PWA manifest
components/
  ui/                      shadcn/ui-style primitives
  clothing/  wardrobe/  search/  import/  outfits/  settings/  layout/  common/
lib/
  db/                      Prisma client, repositories, mappers, IDs
  validation/              Zod schemas (clothing, outfit, primitives)
  import/                  Claude JSON parsing, filename matching, commit
  images/                  validation, storage, staging
  search/                  search text, filters, structured + semantic search
  outfits/                 outfit JSON validation, picker ranking
  export/                  Claude context, Claude prompt, CSV
  backup/                  backup zip, restore
  constants/               categories, vocabularies, field definitions
prisma/                    schema.prisma + migrations
docs/CLAUDE_WARDROBE_PROMPT.md
data/                      your wardrobe (git-ignored)
public/                    icons, service worker
tests/                     vitest suites
scripts/                   icons, prompt doc generation, LAN URL
```

## Development

```bash
npm run dev          # dev server on 0.0.0.0:3000 (phones allowed via allowedDevOrigins)
npm run lint
npm run typecheck
npm test             # vitest — uses a throwaway temp DB + data folder
npm run build
npm run docs:prompt  # regenerate docs/CLAUDE_WARDROBE_PROMPT.md after schema changes
```

The tests cover:
- Claude JSON validation and outfit validation
- Image filename matching, image validation and path traversal
- Duplicate detection
- The transactional import pipeline, including "replace metadata" preserving your edits
- Database CRUD, search and filters
- Outfit reference checks and picker ranking
- Context export, CSV, backup zip, restore, and the database snapshot

Changing the Claude schema: edit `lib/validation/clothing.ts` (and `EXAMPLE_ITEM` in `lib/export/claude-prompt.ts`), then run `npm run docs:prompt`. Keep `schemaVersion` at 1 unless the change breaks existing JSON.

## Roadmap

The foundation is built for these; none of them is implemented yet:

- Semantic/vector search: implement `SemanticSearchProvider` and embed `searchText`.
- Automatic outfit generation, "build outfits around this item", and weather-aware suggestions (using the picker and `Outfit`/`OutfitItem`).
- Outfit history, wear tracking, "haven't worn recently", favourite outfits (new tables that reference existing IDs).
- Packing lists, shopping gap analysis, wardrobe statistics.
- An optional AI API integration behind a setting (off by default).
- An iPhone build of the Expo app (the code is cross-platform; it needs an Apple developer account to install).
