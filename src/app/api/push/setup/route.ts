import { NextResponse, type NextRequest } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { cronSql, vapidKeys } from "@/lib/push";
import { getStore } from "@/lib/store";

// The public key for subscribing, the one-time schedule SQL, and how many devices get reminders.
export async function GET(req: NextRequest) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const devices = (await getStore().listPushSubs()).map((s) => ({ endpoint: s.endpoint, device: s.device }));
    return NextResponse.json({ publicKey: vapidKeys().publicKey, cronSql: cronSql(req.nextUrl.origin), devices });
  } catch (e) {
    return fail(e);
  }
}
