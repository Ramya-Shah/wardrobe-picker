# Wardrobe — Android app (Expo)

The phone version of Wardrobe. It works **fully offline**: the database, your photos and
thumbnails are all stored on the phone. There's no server, no account, and no AI API.
Claude is used only through your own chats, exactly like the web version.

It shares its core logic with the web app through `../lib`: the Claude JSON schema and
validation, filename matching, search and filters, the outfit picker, Claude context export
and the backup format. So both versions accept the same Claude JSON, and backups move
between them.

## Try it with Expo Go (no Android Studio needed)

On your computer (Node.js 20.9+ and git):

```bash
cd mobile
npm install
npx expo start
```

On your Android phone:

1. Install **Expo Go** from the Play Store.
2. Connect the phone to the **same Wi-Fi** as the computer.
3. Open Expo Go → **Scan QR code** → scan the code in the terminal.

The app opens in Expo Go and hot-reloads when the code changes. If the phone can't reach the
computer (for example on guest or office Wi-Fi), use `npx expo start --tunnel`.

> **Expo Go needs the dev server.** Expo Go loads the app's code from your computer each time
> you open it. Your wardrobe data still lives on the phone, but the app itself won't open
> while `npx expo start` isn't running. For an app that opens anywhere, build the APK below.

## Install it as a real offline app (APK)

Build it in Expo's cloud with a free Expo account (https://expo.dev/signup). Only the app's
code is uploaded; your clothes and photos never leave the phone.

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

When the build finishes, open the link it prints on your phone, download the `.apk` and
install it (Android will ask you to allow installing from your browser). Then it's a normal
app on your home screen that works in airplane mode.

To build on your own machine instead, install Android Studio and run `npx expo run:android --variant release`.

**Moving data from Expo Go to the APK:** they're separate installs with separate storage.
In Expo Go go to Settings → **Full backup**, save the zip, then in the APK use Settings →
**Restore a backup**. Backups from the web version restore the same way.

## Everyday use

- **Import from Claude.** Open *Import → Prompt*, copy or share the prompt to the Claude
  app, attach your photos, then copy Claude's JSON reply. Back in *Import from Claude*,
  pick the same photos (Gallery or Files) and tap **Paste**. The preview matches photos to
  items **by filename**, flags errors and duplicates (Skip / Replace metadata / Add anyway),
  and lets you fix items or assign unmatched photos. Nothing is saved until you tap Import.
  - Tip: picking photos through **Files** always keeps the exact original filenames.
- **Add by hand.** Use the + button: take or choose a photo and fill in the form.
- **Search and filters.** Search by any word (color, type, season, occasion…). The filter
  sheet combines filters: any of the values within a group, and all of the groups together.
- **Edit.** Every field is editable. Fields you change are marked *edited by you* and are
  never overwritten by a later "Replace metadata" import.
- **Build outfits yourself.** *Outfits → Build an outfit* (or **Outfit** on any item) shows
  one swipeable row per piece: outerwear, top, bottom or dress, shoes, accessory. Swipe to
  change a piece, **lock** the ones you like, **shuffle** the rest, filter by season, then
  **Save**. **Ask Claude** sends the pieces you've chosen to the outfit picker below.
- **Ask Claude for outfits.** In the Outfit picker, choose an occasion, style, season and required items,
  then tap **Copy for Claude** (or Share straight to the Claude app). Paste Claude's outfit
  JSON into *Import outfit*. Outfits that reference items you don't own are rejected.
- **Backups.** Settings has a full backup (.zip), JSON, CSV and photo exports, all shared to
  Drive, Files, etc. Back up regularly: uninstalling the app deletes its data.
- **Backup reminder.** Settings → *Backup reminder* (Off / 7 / 14 / 30 days, default 14).
  When a backup is due, the home screen shows a reminder with **Back up now** and **Later**
  (Later hides it for 3 days).
- **Dark mode.** Settings → *Appearance*: System (follows the phone), Light or Dark.

## Development

```bash
npm run typecheck   # app + tests
npm run lint        # expo lint
npm test            # data-layer tests (node:sqlite + temp folder)
npx expo-doctor
```

Structure:

```
src/app/         screens (Expo Router): (tabs)/ wardrobe, search, outfits, settings; item/[id],
                 edit/[id], add, import, prompt, builder, picker, outfit/[id], outfit-import, export
src/core/        data layer: schema (SQLite), items, images/staging, import commit,
                 outfits, backup/restore, settings. Platform-independent, behind src/core/services.ts
src/platform/    Expo implementations (expo-sqlite, expo-file-system, image-manipulator, crypto)
                 and photo/file pickers
src/components/  wardrobe browser, cards, form, import preview, sheets
src/ui/          theme and primitives
../lib/          code shared with the web app
```

`metro.config.js` lets Metro load `../lib` while resolving every package from this folder's
`node_modules`, so the app builds without the web app's dependencies installed.
