import { NextResponse } from "next/server";
import { AIError, dictateToTasks, type Upload } from "@/lib/ai";
import { addDays, todayISO } from "@/lib/dates";
import { fail, unauthorized } from "@/lib/guard";
import { toNewTask } from "@/lib/validate";
import type { NewTask } from "@/lib/types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_CHARS = 6_000_000; // base64, ~4.5 MB of file

// Returns a preview of tasks; the client shows it and saves the ones Alexey keeps via POST /api/tasks.
export async function POST(req: Request) {
  const deny = await unauthorized();
  if (deny) return deny;
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; uploads?: unknown; docs?: unknown };
    const text = typeof body.text === "string" ? body.text.slice(0, 8000) : "";
    const uploads = (Array.isArray(body.uploads) ? body.uploads : []).slice(0, 5).filter((u): u is Upload => {
      const x = u as Upload;
      return typeof x?.data === "string" && x.data.length < MAX_UPLOAD_CHARS &&
        ((x.kind === "image" && IMAGE_TYPES.includes(x.media_type)) || (x.kind === "pdf" && x.media_type === "application/pdf"));
    });
    const docs = (Array.isArray(body.docs) ? body.docs : []).slice(0, 5)
      .filter((d): d is { name: string; text: string } => typeof d?.text === "string")
      .map((d) => ({ name: String(d.name || "файл").slice(0, 100), text: d.text.slice(0, 20000) }));
    if (!text.trim() && !uploads.length && !docs.length) return NextResponse.json({ error: "Надиктуй задачи или прикрепи скриншот" }, { status: 400 });
    const fallback = addDays(todayISO(), 1);
    const tasks = (await dictateToTasks(text, uploads, docs)).map((t) => toNewTask(t, fallback)).filter((t): t is NewTask => !!t);
    return NextResponse.json({ tasks });
  } catch (e) {
    return e instanceof AIError ? fail(e, e.status) : fail(e);
  }
}
