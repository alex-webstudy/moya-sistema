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
