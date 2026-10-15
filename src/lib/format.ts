import { formatMinutes, parseHHMM, weekdayName } from "./time";

export function formatPhone(digits: string) {
  return digits && digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

type Hours = { day: number; closed?: boolean | null; open?: string | null; close?: string | null }[];

export function hoursRange(h: Hours[number]) {
  if (h.closed) return "Closed";
  return `${formatMinutes(parseHHMM(h.open ?? ""))} – ${formatMinutes(parseHHMM(h.close ?? ""))}`;
}

/** "Mon–Sat: 10:00 AM – 8:00 PM · Sun: Closed" style summary grouping identical days. */
export function hoursSummary(hours: Hours) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows = order.map((d) => hours.find((h) => h.day === d)).filter(Boolean) as Hours;
  const groups: { days: number[]; label: string }[] = [];
  for (const h of rows) {
    const label = hoursRange(h);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(h.day);
    else groups.push({ days: [h.day], label });
  }
  return groups
    .map((g) => {
      const first = weekdayName(g.days[0], true);
      const lastDay = weekdayName(g.days[g.days.length - 1], true);
      return `${g.days.length > 1 ? `${first}–${lastDay}` : first}: ${g.label}`;
    })
    .join(" · ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
