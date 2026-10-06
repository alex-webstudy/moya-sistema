"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { NewTask, Task, TaskPatch, Thought } from "@/lib/types";

interface State { tasks: Task[]; thoughts: Thought[]; today: string; demo: boolean; ai: boolean; loaded: boolean; error: string }

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 401) {
    // Full reload on purpose: drop all in-memory state when the session has expired.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/login";
    throw new Error("Нужно войти");
  }
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || "Ошибка " + r.status);
  return data;
}

function useAppState() {
  const [s, setS] = useState<State>({ tasks: [], thoughts: [], today: "", demo: false, ai: false, loaded: false, error: "" });
  const [toastMsg, setToast] = useState("");
  const tRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setToast(m);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(""), 2200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await api<Omit<State, "loaded" | "error">>("/api/state");
      setS({ ...d, loaded: true, error: "" });
    } catch (e) {
      setS((x) => ({ ...x, loaded: true, error: (e as Error).message }));
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const fail = useCallback((e: unknown) => toast((e as Error).message || "Не получилось"), [toast]);

  const addTasks = useCallback(async (items: NewTask[]) => {
    try {
      const { tasks } = await api<{ tasks: Task[] }>("/api/tasks", { method: "POST", body: { tasks: items } });
      setS((x) => ({ ...x, tasks: [...x.tasks, ...tasks] }));
      return tasks;
    } catch (e) { fail(e); return []; }
  }, [fail]);

  const patchTask = useCallback(async (id: string, patch: TaskPatch) => {
    let before: Task | undefined;
    setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? ((before = t), { ...t, ...patch }) : t)) }));
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: patch });
    } catch (e) {
      if (before) { const b = before; setS((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === id ? b : t)) })); }
      fail(e);
    }
  }, [fail]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      setS((x) => ({ ...x, tasks: x.tasks.filter((t) => t.id !== id) }));
    } catch (e) { fail(e); }
  }, [fail]);

  const addThought = useCallback(async (text: string) => {
    try {
      const { thought } = await api<{ thought: Thought }>("/api/thoughts", { method: "POST", body: { text } });
      setS((x) => ({ ...x, thoughts: [...x.thoughts, thought] }));
      toast("Сохранено в «Быстрой мысли»");
      return true;
    } catch (e) { fail(e); return false; }
  }, [fail, toast]);

  const deleteThought = useCallback(async (id: string) => {
    try {
      await api(`/api/thoughts/${id}`, { method: "DELETE" });
      setS((x) => ({ ...x, thoughts: x.thoughts.filter((t) => t.id !== id) }));
    } catch (e) { fail(e); }
  }, [fail]);

  const sortThoughts = useCallback(async () => {
    try {
      const { done } = await api<{ done: string[] }>("/api/ai/sort", { method: "POST" });
      await reload();
      toast("Разложено: " + done.length);
      return done;
    } catch (e) { fail(e); return null; }
  }, [fail, reload, toast]);

  const dictate = useCallback(async (body: unknown) => {
    try {
      return (await api<{ tasks: NewTask[] }>("/api/ai/dictate", { method: "POST", body })).tasks;
    } catch (e) { fail(e); return null; }
  }, [fail]);

  return useMemo(
    () => ({ ...s, toastMsg, toast, reload, addTasks, patchTask, deleteTask, addThought, deleteThought, sortThoughts, dictate }),
    [s, toastMsg, toast, reload, addTasks, patchTask, deleteTask, addThought, deleteThought, sortThoughts, dictate],
  );
}

type App = ReturnType<typeof useAppState>;
const Ctx = createContext<App | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useAppState()}>{children}</Ctx.Provider>;
}

export function useApp(): App {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
