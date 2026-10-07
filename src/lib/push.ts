import "server-only";
import { createECDH, timingSafeEqual } from "node:crypto";
import { derive } from "./derive";
import webpush from "web-push";
import { getStore } from "./store";
import type { PushSub } from "./store/types";
import type { Push } from "./reminders";

// Keys are derived from SESSION_SECRET, so push needs no new settings and no secret ever leaves the server.
export function vapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(derive("vapid-v1"));
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: ecdh.getPrivateKey().toString("base64url") };
}

/** Token the database scheduler sends to /api/push/tick. */
export const cronToken = () => derive("cron-v1").toString("hex");

export function cronTokenOk(header: string | null): boolean {
  const got = Buffer.from((header ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(cronToken());
  return got.length === want.length && timingSafeEqual(got, want);
}

/** SQL the owner runs once in Supabase: every 15 minutes the database calls the app. */
export const cronSql = (origin: string) => `-- Напоминания: база будит приложение каждые 15 минут. Можно запускать повторно.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('moya-push', '*/15 * * * *', $$
  select net.http_post(
    url := '${origin}/api/push/tick',
    headers := '{"Authorization": "Bearer ${cronToken()}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
$$);`;

/** Sends one reminder to every device; devices the browser has dropped are forgotten. */
export async function sendToAll(p: Pick<Push, "key" | "title" | "body" | "url">, subject: string): Promise<number> {
  const store = getStore();
  const subs = await store.listPushSubs();
  const { publicKey, privateKey } = vapidKeys();
  const payload = JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.key.split(":")[0] });
  let ok = 0;
  await Promise.all(subs.map(async (s: PushSub) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        // Push services want an https or mailto contact; a local http run has neither.
        vapidDetails: { subject: subject.startsWith("https://") ? subject : "https://localhost", publicKey, privateKey }, TTL: 3600, urgency: "high",
      });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await store.removePushSub(s.endpoint);
      else console.error("push failed", code, e);
    }
  }));
  return ok;
}
