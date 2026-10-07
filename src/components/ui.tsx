"use client";
import { useEffect, useRef, useState } from "react";
import { openInClaude } from "@/lib/openInClaude";
import { CUR, type Cur } from "@/lib/money";
import { useApp } from "./store";

/** Collapsed-by-default block: secondary content stays out of the way. */
export function Fold({ title, sub, children, open: init = false }: { title: string; sub?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(init);
  return (
    <section className="panel fold" style={{ marginBottom: 16 }}>
      <button className="fold-h" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{title}</b><span className="sub">{sub}</span><span className="cv">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="fold-b">{children}</div>}
    </section>
  );
}

export function CurSelect({ value, onChange }: { value: Cur; onChange: (c: Cur) => void }) {
  return (
    <select className="input" aria-label="Валюта" style={{ flex: "0 0 72px" }} value={value} onChange={(e) => onChange(e.target.value as Cur)}>
      {CUR.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
    </select>
  );
}

const readPicture = (f: File) => new Promise<{ media_type: string; data: string }>((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok({ media_type: f.type, data: String(r.result).split(",")[1] ?? "" });
  r.onerror = () => bad(r.error);
  r.readAsDataURL(f);
});

/**
 * One Claude step. With the API key Claude answers right here: the text goes to `onAnswer` (the field the
 * owner used to paste into) or, without one, into a window with a copy button. Without the key it opens
 * Claude with the prompt prefilled (and copied). `prompt` is built on click so it carries fresh data.
 * `picture` asks for a screenshot or PDF first (e.g. a tax report).
 */
export function ClaudeBtn({ prompt, label = "Открыть в Claude ↗", hint, pri = false, className, onAnswer, picture = false }: {
  prompt: () => string; label?: string; hint?: string; pri?: boolean; className?: string; onAnswer?: (text: string) => void; picture?: boolean;
}) {
  const { ai, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const cls = className ?? "btn" + (pri ? " pri" : "");

  async function run(pic?: File) {
    setBusy(true);
    try {
      const body = { prompt: prompt(), picture: pic ? await readPicture(pic) : undefined };
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !out.text) return toast(out.error ?? "Claude не ответил, попробуй ещё раз");
      if (onAnswer) { onAnswer(out.text); toast("Claude ответил: проверь и сохрани"); } else setShown(out.text);
    } catch {
      toast("Нет связи, попробуй ещё раз");
    } finally {
      setBusy(false);
    }
  }

  if (!ai) {
    return (
      <button type="button" className={cls} title="Откроет Claude с готовым запросом, текст запроса также скопирован"
        onClick={() => { openInClaude(prompt()); toast(hint ?? "Запрос открыт в Claude и скопирован"); }}>{label}</button>
    );
  }
  return (
    <>
      {picture && <input ref={file} type="file" hidden accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(f); }} />}
      <button type="button" className={cls} disabled={busy} title="Claude ответит прямо здесь"
        onClick={() => (picture ? file.current?.click() : run())}>{busy ? "Claude думает…" : label.replace(/ в Claude ↗$| ↗$/, "") + " ✦"}</button>
      {shown !== null && <Answer text={shown} onClose={() => setShown(null)} />}
    </>
  );
}

function Answer({ text, onClose }: { text: string; onClose: () => void }) {
  const { toast } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="answer" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="answer-b">{text}</div>
      <div className="acts">
        <button className="btn pri" onClick={() => copy(text, toast)}>Копировать</button>
        <button className="btn" onClick={() => ref.current?.close()}>Закрыть</button>
      </div>
    </dialog>
  );
}

export function copy(text: string, toast: (m: string) => void) {
  navigator.clipboard?.writeText(text).then(() => toast("Скопировано"), () => toast("Не получилось скопировать"));
}

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="sub" style={{ padding: "6px 0" }}>{children}</div>;
