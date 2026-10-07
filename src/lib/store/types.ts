import type { Day, Records, Settings, SettingKey, Table } from "../records";
import type { Idea, NewTask, Note, Platform, Task, TaskPatch, Thought } from "../types";

export interface Store {
  readonly demo: boolean;
  listTasks(): Promise<Task[]>;
  addTasks(tasks: NewTask[]): Promise<Task[]>;
  updateTask(id: string, patch: TaskPatch): Promise<Task | null>;
  deleteTask(id: string): Promise<void>;
  listThoughts(): Promise<Thought[]>;
  addThought(text: string): Promise<Thought>;
  deleteThoughts(ids: string[]): Promise<void>;
  addNote(project: string, text: string): Promise<Note>;
  addIdea(title: string, platform: Platform, format: string): Promise<Idea>;
  // Phase 2: generic rows for the tables in records.ts (already validated by the caller).
  list<T extends Table>(table: T): Promise<Records[T]>;
  insert<T extends Table>(table: T, rows: object[]): Promise<Records[T]>;
  update<T extends Table>(table: T, id: string, patch: object): Promise<Records[T][number] | null>;
  remove(table: Table, id: string): Promise<void>;
  /** Health day by date: insert or update only the given fields. */
  upsertDay(date: string, patch: object): Promise<Day>;
  getSettings(): Promise<Partial<Settings>>;
  // Files: the browser uploads straight to storage by a short-lived signed URL and downloads the same way.
  signUpload(path: string): Promise<string>;
  signDownload(path: string, name: string): Promise<string>;
  setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
  // Push: the owner's devices, and a log so each reminder goes out once.
  listPushSubs(): Promise<PushSub[]>;
  savePushSub(sub: PushSub): Promise<void>;
  removePushSub(endpoint: string): Promise<void>;
  /** Records that a reminder was sent; false when it already was (another run got there first). */
  markSent(key: string): Promise<boolean>;
}

export interface PushSub { endpoint: string; p256dh: string; auth: string; device: string }
