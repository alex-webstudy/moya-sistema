import "server-only";
import { DEFAULT_SETTINGS, type Settings } from "./records";
import type { Snapshot } from "./reminders";
import type { Store } from "./store/types";

/** Everything the reminders and the bot's /today need, read in one go. */
export async function loadSnapshot(store: Store): Promise<Snapshot & { settings: Settings }> {
  const [tasks, thoughts, charges, clients, invoices, days, settings] = await Promise.all([
    store.listTasks(), store.listThoughts(), store.list("charges"), store.list("clients"), store.list("invoices"), store.list("days"), store.getSettings(),
  ]);
  return { tasks, thoughts, rec: { charges, clients, invoices, days }, settings: { ...DEFAULT_SETTINGS, ...settings } };
}
