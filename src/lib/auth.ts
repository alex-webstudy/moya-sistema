// Single-owner login: a password from env, then a signed session cookie.
// Uses Web Crypto only, so it runs both in proxy.ts and in route handlers.
export const COOKIE = "ms_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

export const authEnabled = () => !!process.env.APP_PASSWORD;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET должен быть не короче 32 символов");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 86400;
  const exp = String(Math.floor(now / 1000) + maxAge);
  return { value: `${exp}.${await hmac("owner." + exp)}`, maxAge };
}

export async function verifySession(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!authEnabled()) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmac("owner." + exp));
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  // Compare digests so the comparison time doesn't depend on where the strings differ.
  return safeEqual(await hmac("pw." + input), await hmac("pw." + pw));
}
