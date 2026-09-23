import { randomBytes } from "node:crypto";

// No vowels-lookalikes (0/o, 1/l/i) so IDs survive being read aloud or retyped by Claude.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function randomToken(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Short, stable IDs such as "itm_7k3m9x2p". Clothing IDs are referenced by Claude in outfits. */
export function newClothingId(): string {
  return `itm_${randomToken(8)}`;
}

export function newOutfitId(): string {
  return `out_${randomToken(8)}`;
}

export { SAFE_ID_PATTERN } from "@/lib/constants/limits";
