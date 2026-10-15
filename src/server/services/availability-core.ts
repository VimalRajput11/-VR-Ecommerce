import { istToUtc, parseHHMM } from "@/lib/time";

// Pure slot computation — no database access, so it can be unit tested directly.

export interface DayHours {
  closed?: boolean | null;
  open?: string | null;
  close?: string | null;
  breaks?: { start?: string | null; end?: string | null }[] | null;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface StaffDay {
  id: string;
  /** null = follow salon hours */
  hours: DayHours | null;
  breaks: { start: string; end: string }[];
  busy: Interval[];
}

export interface SlotQuery {
  dateKey: string;
  now: Date;
  durationMin: number;
  bufferMin: number;
  intervalMin: number;
  minLeadMinutes: number;
  salon: DayHours;
  closures: Interval[];
  staff: StaffDay[];
}

export interface Slot {
  minutes: number;
  start: string; // ISO
  staffIds: string[];
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

function breaksToMinutes(breaks: DayHours["breaks"]): [number, number][] {
  return (breaks ?? [])
    .map((b) => [parseHHMM(b.start ?? ""), parseHHMM(b.end ?? "")] as [number, number])
    .filter(([s, e]) => !Number.isNaN(s) && !Number.isNaN(e) && e > s);
}

export function computeSlots(q: SlotQuery): Slot[] {
  if (q.salon.closed) return [];
  const salonOpen = parseHHMM(q.salon.open ?? "");
  const salonClose = parseHHMM(q.salon.close ?? "");
  if (Number.isNaN(salonOpen) || Number.isNaN(salonClose) || salonClose <= salonOpen) return [];
  if (q.durationMin <= 0 || q.intervalMin <= 0) return [];

  const dayStart = istToUtc(q.dateKey, 0).getTime();
  const toMin = (d: Date) => (d.getTime() - dayStart) / 60_000;
  const closures = q.closures.map((c) => [toMin(c.start), toMin(c.end)] as [number, number]);
  const salonBreaks = breaksToMinutes(q.salon.breaks);
  const earliest = Math.ceil((q.now.getTime() + q.minLeadMinutes * 60_000 - dayStart) / 60_000);

  const staff = q.staff
    .filter((s) => !s.hours?.closed)
    .map((s) => {
      const open = s.hours ? Math.max(salonOpen, parseHHMM(s.hours.open ?? "")) : salonOpen;
      const close = s.hours ? Math.min(salonClose, parseHHMM(s.hours.close ?? "")) : salonClose;
      return {
        id: s.id,
        open,
        close,
        breaks: breaksToMinutes(s.breaks),
        busy: s.busy.map((b) => [toMin(b.start), toMin(b.end)] as [number, number]),
      };
    })
    .filter((s) => !Number.isNaN(s.open) && !Number.isNaN(s.close) && s.close > s.open);

  const slots: Slot[] = [];
  for (let t = salonOpen; t + q.durationMin <= salonClose; t += q.intervalMin) {
    if (t < earliest) continue;
    const serviceEnd = t + q.durationMin;
    const occupiedEnd = serviceEnd + q.bufferMin;
    if (salonBreaks.some(([s, e]) => overlaps(t, serviceEnd, s, e))) continue;
    if (closures.some(([s, e]) => overlaps(t, occupiedEnd, s, e))) continue;

    const free = staff
      .filter(
        (s) =>
          t >= s.open &&
          serviceEnd <= s.close &&
          !s.breaks.some(([bs, be]) => overlaps(t, serviceEnd, bs, be)) &&
          !s.busy.some(([bs, be]) => overlaps(t, occupiedEnd, bs, be)),
      )
      .map((s) => s.id);
    if (free.length) slots.push({ minutes: t, start: istToUtc(q.dateKey, t).toISOString(), staffIds: free });
  }
  return slots;
}

/** Total booked length and trailing buffer for a set of services. */
export function summariseServices(services: { durationMin: number; bufferMin?: number | null; price: number; priceVerified?: boolean | null }[]) {
  return {
    durationMin: services.reduce((sum, s) => sum + s.durationMin, 0),
    bufferMin: services.reduce((max, s) => Math.max(max, s.bufferMin ?? 0), 0),
    total: services.reduce((sum, s) => sum + s.price, 0),
    allPricesVerified: services.every((s) => s.priceVerified !== false),
  };
}

export const LOCK_GRANULARITY_MIN = 5;

/** The 5-minute blocks an appointment occupies, used for the unique slot locks. */
export function lockBlocks(start: Date, occupiedMin: number): Date[] {
  const step = LOCK_GRANULARITY_MIN * 60_000;
  const first = Math.floor(start.getTime() / step) * step;
  const last = start.getTime() + occupiedMin * 60_000;
  const blocks: Date[] = [];
  for (let t = first; t < last; t += step) blocks.push(new Date(t));
  return blocks;
}
