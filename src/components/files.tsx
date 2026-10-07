"use client";
import { useRef, useState } from "react";
import { useApp } from "@/components/store";
import type { FileRow } from "@/lib/records";

const kb = (n: number) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1).replace(".", ",") + " МБ" : Math.max(1, Math.round(n / 1024)) + " КБ");

/** Upload button: signs a one-time URL, sends the file straight to storage, then records it. */
export function Upload({ client_id, invoice_id = null, kind, label = "Прикрепить файл", className = "btn" }: { client_id: string; invoice_id?: string | null; kind: FileRow["kind"]; label?: string; className?: string }) {
  const { addRec, toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function send(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) { toast(`«${f.name}» больше 50 МБ`); continue; }
        const r = await fetch("/api/files/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id, name: f.name, size: f.size }) });
        const s = (await r.json()) as { path?: string; url?: string; error?: string };
        if (!r.ok || !s.url || !s.path) throw new Error(s.error || "Не получилось загрузить");
        const put = await fetch(s.url, { method: "PUT", body: f, headers: { "content-type": f.type || "application/octet-stream", "x-upsert": "false" } });
        if (!put.ok) throw new Error("Хранилище не приняло файл");
        await addRec("files", [{ client_id, invoice_id, kind, name: f.name.slice(0, 255), path: s.path, size: f.size, type: (f.type || "").slice(0, 120) }]);
      }
      toast("Файл сохранён");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" hidden multiple onChange={(e) => send(e.target.files)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,.zip" />
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Загружаю…" : label}</button>
    </>
  );
}

/** File links that download through a short-lived signed URL. */
export function Files({ list, compact = false }: { list: FileRow[]; compact?: boolean }) {
  const { removeRec } = useApp();
  if (!list.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 2 : 4 }}>
      {list.map((f) => (
        <span key={f.id} style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, fontSize: compact ? 12 : 13 }}>
          <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", overflowWrap: "anywhere", minWidth: 0 }}>📎 {f.name}</a>
          {!compact && <span className="sub" style={{ fontSize: 11, marginTop: 0, whiteSpace: "nowrap" }}>{kb(f.size)}</span>}
          <button className="mini" aria-label="Удалить файл" onClick={() => confirm(`Удалить файл «${f.name}»?`) && removeRec("files", f.id)}>✕</button>
        </span>
      ))}
    </div>
  );
}
