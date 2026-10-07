import { todayISO } from "./dates";
import type { Folder } from "./records";

/** Folders from the root down to `id`. */
export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const out: Folder[] = [];
  const seen = new Set<string>();
  for (let f = folders.find((x) => x.id === id); f && !seen.has(f.id); f = folders.find((x) => x.id === f!.parent_id)) {
    seen.add(f.id);
    out.unshift(f);
  }
  return out;
}

/** Task project a folder collects: its own, or the nearest parent's. */
export function folderProject(folders: Folder[], id: string | null): string | null {
  return folderPath(folders, id).reverse().find((f) => f.project)?.project ?? null;
}

/** Every folder in tree order with its full path, for selects. */
export function folderOptions(folders: Folder[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (parent: string | null, trail: string[]) => {
    for (const f of folders.filter((x) => x.parent_id === parent).sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const t = [...trail, f.name];
      out.push({ id: f.id, label: t.join(" / ") });
      if (t.length < 8) walk(f.id, t);
    }
  };
  walk(null, []);
  return out;
}

/** A folder and all its subfolders. */
export function subtree(folders: Folder[], id: string): Set<string> {
  const out = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of folders) if (f.parent_id && out.has(f.parent_id) && !out.has(f.id)) { out.add(f.id); grew = true; }
  }
  return out;
}

/** Where a task belongs, for one select: "f:<folder id>" for a project folder, "p:<name>" for a whole section. */
export const placeOf = (t: { project: string; folder_id?: string | null }) => (t.folder_id ? "f:" + t.folder_id : "p:" + t.project);

/** Turn a place back into task fields; a folder also sets the section it collects. */
export function fromPlace(folders: Folder[], v: string, fallback: string): { project: string; folder_id: string | null } {
  if (v.startsWith("f:")) return { folder_id: v.slice(2), project: folderProject(folders, v.slice(2)) ?? fallback };
  return { folder_id: null, project: v.slice(2) || fallback };
}

/** A task's place as shown under its title: the folder path, or the section. */
export function placeLabel(folders: Folder[], t: { project: string; folder_id?: string | null }): string {
  if (!t.folder_id) return t.project;
  const p = folderPath(folders, t.folder_id);
  return p.length ? p.map((f) => f.name).join(" / ") : t.project;
}

/** Done tasks of a project as a plain-text report, oldest first. */
export function taskReport(name: string, done: { title: string; due: string | null; done_at?: string | null; created_at: string }[], fmt: (d: string) => string): string {
  const when = (t: { due: string | null; done_at?: string | null; created_at: string }) => (t.done_at ? todayISO(new Date(t.done_at)) : t.due ?? t.created_at.slice(0, 10));
  const list = [...done].sort((a, b) => when(a).localeCompare(when(b)));
  if (!list.length) return "";
  const from = when(list[0]), to = when(list[list.length - 1]);
  return [
    `Отчёт по проекту «${name}»`,
    `Период: ${from === to ? fmt(from) : `${fmt(from)} — ${fmt(to)}`}`,
    "",
    `Выполнено задач: ${list.length}`,
    ...list.map((t) => `• ${fmt(when(t))} — ${t.title}`),
  ].join("\n");
}
