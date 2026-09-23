import type { Services } from "./services";

// Same alphabet and shape as the web app: short IDs that Claude can copy reliably.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function randomToken(svc: Pick<Services, "randomBytes">, length = 10): string {
  const bytes = svc.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newClothingId = (svc: Pick<Services, "randomBytes">) => `itm_${randomToken(svc, 8)}`;
export const newOutfitId = (svc: Pick<Services, "randomBytes">) => `out_${randomToken(svc, 8)}`;
