import { NextResponse } from "next/server";
import { fail, unauthorized } from "@/lib/guard";
import { getStore } from "@/lib/store";
import { toThoughtText } from "@/lib/validate";

export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const text = toThoughtText(await req.json().catch(() => ({})));
    if (!text) return NextResponse.json({ error: "Пустая мысль" }, { status: 400 });
    return NextResponse.json({ thought: await getStore().addThought(text) });
  } catch (e) {
    return fail(e);
  }
}
