import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Day, Records, Settings, SettingKey, Table } from "../records";
import type { Idea, NewTask, Note, Platform, Task, TaskPatch, Thought } from "../types";
import type { PushSub, Store } from "./types";

// Server-only: uses the service role key. Tables have RLS on with no policies,
// so the anon key can read nothing; every request goes through our authenticated API.
let client: SupabaseClient | null = null;
const sb = () =>
  (client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));

const BUCKET = "docs";

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
    let r = await sb().from("tasks").update(patch).eq("id", id).select();
    // Before 0009 is run the table has no done_at: still let tasks be ticked off.
    if (r.error && "done_at" in patch && /done_at/.test(r.error.message)) {
      const rest = { ...patch };
      delete rest.done_at;
      r = await sb().from("tasks").update(rest).eq("id", id).select();
    }
    const rows = check(r) as Task[];
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
  async list<T extends Table>(table: T) {
    return check(await sb().from(table).select("*").order("created_at")) as Records[T];
  },
  async insert<T extends Table>(table: T, rows: object[]) {
    if (!rows.length) return [] as unknown as Records[T];
    return check(await sb().from(table).insert(rows).select()) as Records[T];
  },
  async update<T extends Table>(table: T, id: string, patch: object) {
    const rows = check(await sb().from(table).update(patch).eq("id", id).select()) as Records[T];
    return rows[0] ?? null;
  },
  async remove(table: Table, id: string) {
    // Deleting a client, an invoice or a file row also deletes the stored files it owns.
    const col = { files: "id", clients: "client_id", invoices: "invoice_id" }[table as string];
    const paths = col ? (check(await sb().from("files").select("path").eq(col, id)) as { path: string }[]).map((f) => f.path) : [];
    check(await sb().from(table).delete().eq("id", id));
    if (paths.length) await sb().storage.from(BUCKET).remove(paths);
  },
  async upsertDay(date: string, patch: object) {
    // On conflict only the sent columns are updated, so fields set elsewhere survive.
    const rows = check(await sb().from("days").upsert({ ...patch, date }, { onConflict: "date" }).select()) as Day[];
    return rows[0];
  },
  async signUpload(path: string) {
    return check(await sb().storage.from(BUCKET).createSignedUploadUrl(path)).signedUrl;
  },
  async signDownload(path: string, name: string) {
    return check(await sb().storage.from(BUCKET).createSignedUrl(path, 60, { download: name })).signedUrl;
  },
  async getSettings() {
    const rows = check(await sb().from("settings").select("id, value")) as { id: string; value: unknown }[];
    return Object.fromEntries(rows.map((r) => [r.id, r.value])) as Partial<Settings>;
  },
  async setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
    check(await sb().from("settings").upsert({ id: key, value, updated_at: new Date().toISOString() }));
  },
  async listPushSubs() {
    return check(await sb().from("push_subs").select("endpoint, p256dh, auth, device")) as PushSub[];
  },
  async savePushSub(sub: PushSub) {
    check(await sb().from("push_subs").upsert(sub));
  },
  async removePushSub(endpoint: string) {
    check(await sb().from("push_subs").delete().eq("endpoint", endpoint));
  },
  async markSent(key: string) {
    const r = await sb().from("push_log").insert({ key });
    if (r.error?.code === "23505") return false; // unique_violation: already sent
    check(r);
    return true;
  },
};
