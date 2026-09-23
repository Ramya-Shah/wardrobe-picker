// Generates the PWA PNG icons from public/icons/icon.svg. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

for (const size of [192, 512]) await sharp(svg).resize(size, size).png().toFile(out(`icon-${size}.png`));
await sharp(svg).resize(180, 180).flatten({ background: "#faf9f7" }).png().toFile(out("apple-touch-icon.png"));

// Maskable: artwork inside the central safe zone on a full-bleed background.
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#faf9f7" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("icon-maskable-512.png"));
console.log("icons generated");
