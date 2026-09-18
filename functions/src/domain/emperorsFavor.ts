import { createHmac, randomInt } from "node:crypto";

export const EMPERORS_FAVOR_CODE_LENGTH = 6;
export const EMPERORS_FAVOR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const EMPERORS = [
  "AUGUSTUS",
  "TRAIANUS",
  "HADRIANUS",
  "AURELIANUS",
  "CONSTANTINUS",
  "JUSTINIANUS",
  "BASILEIOS",
] as const;

export function normalizeEmperorsFavor(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isValidEmperorsFavorFormat(value: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalizeEmperorsFavor(value));
}

export function fingerprintEmperorsFavor(value: string, hmacKey: string): string {
  const normalized = normalizeEmperorsFavor(value);
  if (!isValidEmperorsFavorFormat(normalized)) {
    throw new Error("Invalid Emperor's Favor format.");
  }
  if (hmacKey.length < 32) {
    throw new Error("Emperor's Favor HMAC key is not configured securely.");
  }
  return createHmac("sha256", hmacKey)
    .update(`AOF_EMPERORS_FAVOR_V1:${normalized}`)
    .digest("hex");
}

export function generateEmperorsFavorCode(): string {
  let code = "";
  for (let index = 0; index < EMPERORS_FAVOR_CODE_LENGTH; index += 1) {
    code += EMPERORS_FAVOR_ALPHABET[randomInt(EMPERORS_FAVOR_ALPHABET.length)];
  }
  return code;
}

export function randomEmperor(): typeof EMPERORS[number] {
  return EMPERORS[randomInt(EMPERORS.length)];
}

export function romanNumeral(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) return String(value);
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let result = "";
  for (const [amount, numeral] of table) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}
