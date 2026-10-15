import { badRequest } from "@/server/lib/errors";
import { hhmm } from "@/server/lib/validate";
import { GRANTABLE_PERMISSIONS } from "@/lib/permissions";
import type { UserDoc } from "@/server/models";

export function parseWorkingHours(raw: unknown) {
  if (!Array.isArray(raw)) throw badRequest("workingHours must be a list.", "workingHours");
  const seen = new Set<number>();
  return raw.slice(0, 7).map((h: Record<string, unknown>) => {
    const day = Number(h.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) throw badRequest("Invalid working day.", "workingHours");
    seen.add(day);
    const closed = h.closed === true;
    const open = closed ? "00:00" : hhmm(h.open, "open");
    const close = closed ? "00:00" : hhmm(h.close, "close");
    if (!closed && close <= open) throw badRequest("Closing time must be after opening time.", "workingHours");
    return { day, closed, open, close };
  });
}

export function parseBreaks(raw: unknown, withDay: boolean) {
  if (!Array.isArray(raw)) throw badRequest("breaks must be a list.", "breaks");
  return raw.slice(0, 30).map((b: Record<string, unknown>) => {
    const start = hhmm(b.start, "break start");
    const end = hhmm(b.end, "break end");
    if (end <= start) throw badRequest("Break end must be after its start.", "breaks");
    if (!withDay) return { start, end };
    const day = Number(b.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw badRequest("Invalid break day.", "breaks");
    return { day, start, end };
  });
}

export function parseExtraPermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw badRequest("permissions must be a list.", "extraPermissions");
  return [...new Set(raw.filter((p): p is string => typeof p === "string" && (GRANTABLE_PERMISSIONS as string[]).includes(p)))];
}

export function serialiseStaff(u: UserDoc) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email ?? "",
    phone: u.phone ?? "",
    role: u.role,
    active: u.active !== false,
    extraPermissions: u.extraPermissions ?? [],
    title: u.staff?.title ?? "",
    bio: u.staff?.bio ?? "",
    bookable: !!u.staff?.bookable,
    services: (u.staff?.services ?? []).map(String),
    workingHours: (u.staff?.workingHours ?? []).map((h) => ({ day: h.day, closed: !!h.closed, open: h.open, close: h.close })),
    breaks: (u.staff?.breaks ?? []).map((b) => ({ day: b.day, start: b.start, end: b.end })),
    lastLoginAt: u.lastLoginAt,
  };
}
