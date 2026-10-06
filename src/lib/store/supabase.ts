import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Idea, NewTask, Note, Platform, Task, TaskPatch, Thought } from "../types";
import type { Store } from "./types";

// Server-only: uses the service role key. Tables have RLS on with no policies,
// so the anon key can read nothing; every request goes through our authenticated API.
let client: SupabaseClient | null = null;
const sb = () =>
  (client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const supabaseStore: Store = {
  demo: false,
  async listTasks() {
    return check(await sb().from("tasks").select("*").order("due").order("time", { nullsFirst: false })) as Task[];
  },
  async addTasks(items: NewTask[]) {
    if (!items.length) return [];
    return check(await sb().from("tasks").insert(items).select()) as Task[];
  },
  async updateTask(id: string, patch: TaskPatch) {
    const rows = check(await sb().from("tasks").update(patch).eq("id", id).select()) as Task[];
    return rows[0] ?? null;
  },
  async deleteTask(id: string) {
    check(await sb().from("tasks").delete().eq("id", id));
  },
  async listThoughts() {
    return check(await sb().from("thoughts").select("*").order("created_at")) as Thought[];
  },
  async addThought(text: string) {
    return check(await sb().from("thoughts").insert({ text }).select().single()) as Thought;
  },
  async deleteThoughts(ids: string[]) {
    if (ids.length) check(await sb().from("thoughts").delete().in("id", ids));
  },
  async addNote(project: string, text: string) {
    return check(await sb().from("notes").insert({ project, text }).select().single()) as Note;
  },
  async addIdea(title: string, platform: Platform, format: string) {
    return check(await sb().from("ideas").insert({ title, platform, format }).select().single()) as Idea;
  },
};
