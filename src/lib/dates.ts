// All dates are plain YYYY-MM-DD strings in the owner's timezone (Tashkent).
export const TZ = "Asia/Tashkent";

export const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONN = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function todayISO(now: Date = new Date(), tz: string = TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nowHour(now: Date = new Date(), tz: string = TZ): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
}

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (x: Date) => x.toISOString().slice(0, 10);

export const isISODate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s).getTime());
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export function addDays(s: string, n: number): string {
  const x = parse(s);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

export function diffDays(s: string, from: string): number {
  return Math.round((parse(s).getTime() - parse(from).getTime()) / 864e5);
}

export function weekday(s: string): number {
  return parse(s).getUTCDay();
}

/** «сегодня», «завтра», «вчера» or «12 окт» relative to `today`. */
export function fd(s: string, today: string): string {
  const diff = diffDays(s, today);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  const x = parse(s);
  return x.getUTCDate() + " " + MON[x.getUTCMonth()];
}

/** Monday..Sunday of the week containing `s`, shifted by `offset` weeks. */
export function weekDays(s: string, offset = 0): string[] {
  const mon = addDays(s, -((weekday(s) + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Days of the month containing `s` shifted by `offset` months, plus leading blanks for a Monday-first grid. */
export function monthGrid(s: string, offset = 0): { year: number; month: number; lead: number; days: string[] } {
  const x = parse(s);
  const first = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + offset, 1));
  const year = first.getUTCFullYear(), month = first.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => fmt(new Date(Date.UTC(year, month, i + 1))));
  return { year, month, lead: (first.getUTCDay() + 6) % 7, days };
}

export const dayNum = (s: string) => parse(s).getUTCDate();
export const monthOf = (s: string) => parse(s).getUTCMonth();

/** A task's deadline for display: «без срока» when it has none. */
export const fdue = (due: string | null, today: string) => (due ? fd(due, today) : "без срока");
/** Sort by deadline; tasks without one go last. */
export const byDue = (a: { due: string | null }, b: { due: string | null }) => (a.due ?? "9999").localeCompare(b.due ?? "9999");
