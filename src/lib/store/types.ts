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
}
