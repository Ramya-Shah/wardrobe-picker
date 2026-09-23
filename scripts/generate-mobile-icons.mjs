// Generates the Expo app icons in mobile/assets from public/icons/icon.svg.
// Run from the repo root (uses the web app's sharp): node scripts/generate-mobile-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = (await readFile(new URL("../public/icons/icon.svg", import.meta.url), "utf8"));
const out = (name) => new URL(`../mobile/assets/${name}`, import.meta.url).pathname;
// The hanger artwork alone (no background tile), stroked in a given color.
const art = (color) =>
  Buffer.from(svg.replace(/<rect[^>]*\/>/, "").replace(/stroke="#2a2724"/, `stroke="${color}"`));

await sharp(Buffer.from(svg)).resize(1024, 1024).flatten({ background: "#faf9f7" }).png().toFile(out("icon.png"));
// Android adaptive icon: artwork inside the central safe zone.
const fg = await sharp(art("#2a2724")).resize(600, 600).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, gravity: "center" }]).png().toFile(out("android-icon-foreground.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#faf9f7" } }).png().toFile(out("android-icon-background.png"));
const mono = await sharp(art("#ffffff")).resize(600, 600).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: mono, gravity: "center" }]).png().toFile(out("android-icon-monochrome.png"));
await sharp(art("#2a2724")).resize(512, 512).png().toFile(out("splash-icon.png"));
await sharp(Buffer.from(svg)).resize(48, 48).png().toFile(out("favicon.png"));
console.log("mobile icons generated");
