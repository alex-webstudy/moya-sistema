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
  setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
}
