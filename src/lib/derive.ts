import "server-only";
import { createHmac } from "node:crypto";

/** Server keys and tokens derived from SESSION_SECRET, so new features need no new secrets. */
export function derive(label: string): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET должен быть не короче 32 символов");
  return createHmac("sha256", s).update(label).digest();
}
