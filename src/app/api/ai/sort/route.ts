import { NextResponse } from "next/server";
import { AIError } from "@/lib/ai";
import { fail, unauthorized } from "@/lib/guard";
import { sortInto } from "@/lib/sort";
import { getStore } from "@/lib/store";

// Sorts every open thought into a task, a project note or a content idea, then removes it from the inbox.
export async function POST() {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const store = getStore();
    return NextResponse.json({ done: await sortInto(store, await store.listThoughts()) });
  } catch (e) {
    return e instanceof AIError ? fail(e, e.status) : fail(e);
  }
}
