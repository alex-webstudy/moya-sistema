// Password vault crypto, browser side only. The master password never leaves the device:
// PBKDF2 (SHA-256) turns it into an AES-GCM key, and the server stores only ciphertext.
export const ITERATIONS = 600_000;
const CHECK = "moya-sistema-vault";

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(password: string, salt: string, iterations = ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, value: unknown): Promise<{ data: string; iv: string }> {
  const iv = rnd(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { data: b64(data), iv: b64(iv) };
}

export async function open<T>(key: CryptoKey, box: { data: string; iv: string }): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data));
  return JSON.parse(dec.decode(plain)) as T;
}

export type Meta = { salt: string; iv: string; check: string };

/** New master password: a random salt and an encrypted check value to recognise the password later. */
export async function createMeta(password: string, iterations = ITERATIONS): Promise<{ meta: Meta; key: CryptoKey }> {
  const salt = b64(rnd(16));
  const key = await deriveKey(password, salt, iterations);
  const box = await seal(key, CHECK);
  return { meta: { salt, iv: box.iv, check: box.data }, key };
}

/** The key when the password is right, otherwise null. */
export async function unlock(password: string, meta: Meta, iterations = ITERATIONS): Promise<CryptoKey | null> {
  const key = await deriveKey(password, meta.salt, iterations);
  try {
    return (await open<string>(key, { data: meta.check, iv: meta.iv })) === CHECK ? key : null;
  } catch {
    return null;
  }
}

export type Entry = { cat: string; name: string; login: string; pass: string; url: string; note: string };

/** Random password without look-alike characters. */
export function genPassword(len = 16): string {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*-_+=?";
  const out: string[] = [];
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (const x of buf) out.push(abc[x % abc.length]);
  return out.join("");
}
