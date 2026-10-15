// Date/time helpers for the salon. All instants are stored in UTC; everything shown to
// people is rendered in Asia/Kolkata. IST has a fixed +05:30 offset and no DST, which lets
// us convert between wall-clock time and UTC with plain arithmetic.

export const TIMEZONE = "Asia/Kolkata";
export const LOCALE = "en-IN";
const IST_OFFSET_MIN = 330;
const MINUTE = 60_000;

/** YYYY-MM-DD of the given instant as seen in IST. */
export function dateKeyIST(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * MINUTE).toISOString().slice(0, 10);
}

export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

/** UTC instant for `minutes` after midnight IST on `dateKey`. */
export function istToUtc(dateKey: string, minutes = 0): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - IST_OFFSET_MIN * MINUTE);
}

/** Minutes after IST midnight for an instant. */
export function minutesOfDayIST(d: Date): number {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * MINUTE);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOfDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "10:30" -> 630. Returns NaN on bad input. */
export function parseHHMM(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 630 -> "10:30 AM" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** DD/MM/YYYY in IST */
export function formatDate(value: Date | string | number): string {
  const [y, m, d] = dateKeyIST(toDate(value)).split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY for a YYYY-MM-DD key */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** 12-hour time in IST, e.g. "4:15 PM" */
export function formatTime(value: Date | string | number): string {
  return formatMinutes(minutesOfDayIST(toDate(value)));
}

export function formatDateTime(value: Date | string | number): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(day: number, short = false): string {
  const name = WEEKDAYS[day] ?? "";
  return short ? name.slice(0, 3) : name;
}

export function formatLongDateKey(key: string): string {
  const day = weekdayName(weekdayOfDateKey(key), true);
  return `${day}, ${formatDateKey(key)}`;
}
