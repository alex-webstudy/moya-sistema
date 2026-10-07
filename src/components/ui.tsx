"use client";
import { useState } from "react";
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

/** Opens Claude with the prompt prefilled (and copied). `prompt` is built on click so it carries fresh data. */
export function ClaudeBtn({ prompt, label = "Открыть в Claude ↗", hint, pri = false, className }: { prompt: () => string; label?: string; hint?: string; pri?: boolean; className?: string }) {
  const { toast } = useApp();
  return (
    <button
      type="button"
      className={className ?? "btn" + (pri ? " pri" : "")}
      title="Откроет Claude с готовым запросом, текст запроса также скопирован"
      onClick={() => {
        openInClaude(prompt());
        toast(hint ?? "Запрос открыт в Claude и скопирован");
      }}
    >{label}</button>
  );
}

export function copy(text: string, toast: (m: string) => void) {
  navigator.clipboard?.writeText(text).then(() => toast("Скопировано"), () => toast("Не получилось скопировать"));
}

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="sub" style={{ padding: "6px 0" }}>{children}</div>;
