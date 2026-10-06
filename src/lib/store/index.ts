import "server-only";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const hasDatabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function getStore(): Store {
  if (hasDatabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO !== "1") {
    throw new Error("База не подключена: задай SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
  }
  return memoryStore;
}
