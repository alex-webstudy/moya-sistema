"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (r.ok) router.replace("/");
    else setErr(((await r.json().catch(() => ({}))) as { error?: string }).error || "Не получилось войти");
  }
  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <h1>Моя система</h1>
        <input className="input" type="password" autoComplete="current-password" placeholder="Пароль" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required />
        {err && <div className="err">{err}</div>}
        <button className="btn pri" disabled={busy}>{busy ? "Вхожу…" : "Войти"}</button>
      </form>
    </div>
  );
}
