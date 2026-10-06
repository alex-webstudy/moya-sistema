import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, verifySession } from "./auth";

/** Every route handler calls this first; proxy.ts is not the only line of defence. */
export async function unauthorized(): Promise<NextResponse | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return (await verifySession(token)) ? null : NextResponse.json({ error: "Нужно войти" }, { status: 401 });
}

export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : "Ошибка сервера";
  console.error(e);
  return NextResponse.json({ error: message }, { status });
}
