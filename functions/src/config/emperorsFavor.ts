import { defineSecret } from "firebase-functions/params";
import type { CallableOptions } from "firebase-functions/v2/https";
import { callableOptions } from "./runtime.js";

export const emperorsFavorHmacKey = defineSecret("EMPERORS_FAVOR_HMAC_KEY");

export const emperorsFavorCallableOptions: CallableOptions = {
  ...callableOptions,
  secrets: [emperorsFavorHmacKey],
};

export function readEmperorsFavorHmacKey(): string {
  const value = emperorsFavorHmacKey.value();
  if (value.length < 32) {
    throw new Error("EMPERORS_FAVOR_HMAC_KEY must contain at least 32 characters.");
  }
  return value;
}
