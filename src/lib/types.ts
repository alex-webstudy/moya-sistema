export const PROJECTS = ["Instagram", "YouTube", "Telegram", "Курсы", "Клиенты", "Личное", "Здоровье"] as const;
export type Project = string;

export interface Task {
  id: string;
  title: string;
  project: Project;
  due: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  done: boolean;
  goal_id?: string | null; // a step of a goal
  folder_id?: string | null; // a specific project folder, e.g. one client
  done_at?: string | null;
  created_at: string;
}

export interface Thought {
  id: string;
  text: string;
  created_at: string;
}

export interface Note {
  id: string;
  project: Project;
  text: string;
  created_at: string;
}

export const PLATFORMS = { tg: ["post", "audio", "video"], ig: ["carousel", "post", "reels"], yt: ["shorts", "long"] } as const;
export type Platform = keyof typeof PLATFORMS;

export interface Idea {
  id: string;
  title: string;
  platform: Platform;
  format: string;
  created_at: string;
}

export type NewTask = Pick<Task, "title" | "project" | "due" | "time"> & { goal_id?: string | null; folder_id?: string | null };
export type TaskPatch = Partial<Pick<Task, "title" | "project" | "due" | "time" | "done" | "folder_id" | "done_at">>;

export type Training = { days: number[]; start: string; end: string }; // days: 0 = Sunday
