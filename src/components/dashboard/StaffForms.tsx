"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Alert, Button, Card, Checkbox, Input, Select, Spinner } from "@/components/ui";
import { formatDateTime, weekdayName } from "@/lib/time";

export interface DayHours {
  day: number;
  closed: boolean;
  open: string;
  close: string;
}
export interface Break {
  day: number;
  start: string;
  end: string;
}

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Per-day working hours for a staff member; empty list = follows salon hours. */
export function HoursEditor({ hours, breaks, onChange }: { hours: DayHours[]; breaks: Break[]; onChange: (hours: DayHours[], breaks: Break[]) => void }) {
  const custom = hours.length > 0;
  const full = ORDER.map((d) => hours.find((h) => h.day === d) ?? { day: d, closed: false, open: "10:00", close: "20:00" });
  const setDay = (day: number, patch: Partial<DayHours>) => onChange(full.map((h) => (h.day === day ? { ...h, ...patch } : h)), breaks);
  return (
    <div className="space-y-3">
      <Checkbox label="Use custom working hours (otherwise follows salon opening hours)" checked={custom} onChange={(e) => onChange(e.target.checked ? full : [], breaks)} />
      {custom && (
        <div className="space-y-2">
          {full.map((h) => (
            <div key={h.day} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24">{weekdayName(h.day)}</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="accent-[#85652f]" checked={!h.closed} onChange={(e) => setDay(h.day, { closed: !e.target.checked })} /> Working
              </label>
              {!h.closed && (
                <>
                  <input type="time" aria-label={`${weekdayName(h.day)} start`} value={h.open} onChange={(e) => setDay(h.day, { open: e.target.value })} className="rounded border border-sand px-2 py-1" />
                  –
                  <input type="time" aria-label={`${weekdayName(h.day)} end`} value={h.close} onChange={(e) => setDay(h.day, { close: e.target.value })} className="rounded border border-sand px-2 py-1" />
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone">Regular breaks</p>
        {breaks.map((b, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <select aria-label="Break day" value={b.day} onChange={(e) => onChange(hours, breaks.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)))} className="rounded border border-sand px-2 py-1">
              {ORDER.map((d) => (
                <option key={d} value={d}>
                  {weekdayName(d)}
                </option>
              ))}
            </select>
            <input type="time" aria-label="Break start" value={b.start} onChange={(e) => onChange(hours, breaks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="rounded border border-sand px-2 py-1" />
            –
            <input type="time" aria-label="Break end" value={b.end} onChange={(e) => onChange(hours, breaks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="rounded border border-sand px-2 py-1" />
            <Button size="sm" variant="ghost" onClick={() => onChange(hours, breaks.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onChange(hours, [...breaks, { day: 1, start: "14:00", end: "14:30" }])}>
            + Break
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(hours, [...breaks.filter((b) => !(b.start === "14:00" && b.end === "14:30")), ...ORDER.map((d) => ({ day: d, start: "14:00", end: "14:30" }))])}>
            Lunch 2:00–2:30 PM every day
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Converts a datetime-local value (interpreted as IST) to an ISO instant. */
export function istLocalToIso(value: string) {
  return new Date(`${value}:00+05:30`).toISOString();
}

interface TimeOffItem {
  id: string;
  staffId: string | null;
  staffName: string;
  kind: string;
  start: string;
  end: string;
  reason: string;
}

/** Leave, holidays and blocked time. `staffId` fixes the panel to one person (self-service). */
export function TimeOffPanel({ staffOptions, fixedStaffId }: { staffOptions?: { id: string; name: string }[]; fixedStaffId?: string }) {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ items: TimeOffItem[] }>(`/api/admin/timeoff${qs({ staff: fixedStaffId })}`);
  const [f, setF] = useState({ staffId: fixedStaffId ?? "", kind: fixedStaffId ? "leave" : "holiday", start: "", end: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [clashes, setClashes] = useState<{ ref: string; start: string; customer: string }[]>([]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ clashes: { ref: string; start: string; customer: string }[] }>("/api/admin/timeoff", {
        body: { staffId: f.staffId || null, kind: f.kind, start: istLocalToIso(f.start), end: istLocalToIso(f.end), reason: f.reason || undefined },
      });
      setClashes(res.clashes);
      toast("Time off added.");
      setF({ ...f, start: "", end: "", reason: "" });
      reload();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await apiFetch(`/api/admin/timeoff/${id}`, { method: "DELETE" });
    toast("Removed.");
    reload();
  }

  const items = (data?.items ?? []).filter((i) => !fixedStaffId || i.staffId === fixedStaffId || i.staffId === null);
  return (
    <Card title={fixedStaffId ? "My leave & blocked time" : "Holidays, closures & leave"}>
      {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
      {clashes.length > 0 && (
        <Alert tone="warning" className="mb-3">
          These existing bookings overlap and need to be moved: {clashes.map((c) => `${c.ref} (${c.customer}, ${formatDateTime(c.start)})`).join("; ")}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!fixedStaffId && (
          <Select label="Who" value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value, kind: e.target.value ? "leave" : "holiday" })}>
            <option value="">Whole salon</option>
            {(staffOptions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {f.staffId ? (
            <>
              <option value="leave">Leave</option>
              <option value="block">Blocked time</option>
            </>
          ) : (
            <>
              <option value="holiday">Holiday</option>
              <option value="closure">Closure</option>
              <option value="block">Blocked slot</option>
            </>
          )}
        </Select>
        <Input label="From (IST)" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        <Input label="To (IST)" type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        <Input label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </div>
      <Button className="mt-3" size="sm" onClick={add} loading={busy} disabled={!f.start || !f.end}>
        Add
      </Button>
      <div className="mt-5">
        {loading ? (
          <Spinner />
        ) : items.length ? (
          <ul className="divide-y divide-beige text-sm">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{t.staffName}</span> · <span className="capitalize">{t.kind}</span> · {formatDateTime(t.start)} → {formatDateTime(t.end)}
                  {t.reason ? ` · ${t.reason}` : ""}
                </span>
                {(!fixedStaffId || t.staffId === fixedStaffId) && (
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">No upcoming time off.</p>
        )}
      </div>
    </Card>
  );
}
