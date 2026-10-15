"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Alert, Badge, Button, Input, Modal, Select, Spinner, StatusBadge, Textarea, buttonClass, cx } from "@/components/ui";
import type { StaffAppointment, StaffLite } from "./types";
import { STATUS_LABELS, type AppointmentStatus } from "@/lib/constants";
import { dateKeyIST, formatDate, formatDateTime, formatTime } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { formatDuration, formatPhone } from "@/lib/format";

const NEXT_ACTIONS: Record<string, { to: AppointmentStatus; label: string; variant?: "primary" | "secondary" | "danger" | "ghost" }[]> = {
  pending: [
    { to: "confirmed", label: "Confirm" },
    { to: "checked_in", label: "Check in", variant: "secondary" },
    { to: "no_show", label: "No-show", variant: "ghost" },
    { to: "cancelled", label: "Cancel", variant: "danger" },
  ],
  confirmed: [
    { to: "checked_in", label: "Check in" },
    { to: "in_progress", label: "Start service", variant: "secondary" },
    { to: "no_show", label: "No-show", variant: "ghost" },
    { to: "cancelled", label: "Cancel", variant: "danger" },
  ],
  checked_in: [
    { to: "in_progress", label: "Start service" },
    { to: "cancelled", label: "Cancel", variant: "danger" },
  ],
  in_progress: [{ to: "completed", label: "Mark completed" }],
};

export default function AppointmentModal({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged?: () => void }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const { data, error, loading, setData } = useApi<{ appointment: StaffAppointment; invoice: { id: string; number: string; status: string; balanceDue: number } | null }>(
    id ? `/api/admin/appointments/${id}` : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiClientError | null>(null);
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [notes, setNotes] = useState({ internalNotes: "", serviceNotes: "" });

  const appt = data?.appointment;
  const [notesFrom, setNotesFrom] = useState<typeof appt>(undefined);
  if (appt && appt !== notesFrom) {
    setNotesFrom(appt);
    setNotes({ internalNotes: appt.internalNotes ?? "", serviceNotes: appt.serviceNotes ?? "" });
  }
  const [lastId, setLastId] = useState(id);
  if (lastId !== id) {
    setLastId(id);
    setConfirmCancel(false);
    setReschedule(false);
    setActionError(null);
    setNote("");
  }

  const manage = can("appointments.manage");
  const isOwn = appt?.staffId === user?.id;

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setActionError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>(`/api/admin/appointments/${id}`, { method: "PATCH", body });
      setData(res);
      onChanged?.();
      toast(label);
      return true;
    } catch (e) {
      setActionError(e as ApiClientError);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const actions = (appt ? NEXT_ACTIONS[appt.status] ?? [] : []).filter((a) => manage || (isOwn && can("appointments.status_own") && ["in_progress", "completed"].includes(a.to)));

  return (
    <Modal open={!!id} onClose={onClose} title={appt ? `Appointment ${appt.ref}` : "Appointment"} size="lg">
      {loading && !appt ? (
        <Spinner />
      ) : error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : appt ? (
        <div className="space-y-6">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          {appt.request?.type && !appt.request.resolved && (
            <Alert tone="warning">
              Customer requested to <strong>{appt.request.type}</strong>
              {appt.request.preferredTime ? ` — preferred: ${appt.request.preferredTime}` : ""}
              {appt.request.reason ? ` — “${appt.request.reason}”` : ""}.
              {manage && (
                <button type="button" className="ml-2 underline" onClick={() => patch({ action: "resolve_request" }, "Request marked as handled")}>
                  Mark handled
                </button>
              )}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-stone">When</p>
              <p className="font-medium">
                {formatDate(appt.start)}, {formatTime(appt.start)} – {formatTime(appt.end)}
              </p>
              <p className="text-sm text-stone">{formatDuration(appt.durationMin)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-stone">Status</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={appt.status} />
                <Badge>{appt.source.replace("_", "-")}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-stone">Customer</p>
              <p className="font-medium">
                {can("customers.view") ? <Link href={`/dashboard/customers?id=${appt.customerId}`} className="hover:underline">{appt.customer.name}</Link> : appt.customer.name}
              </p>
              {appt.customer.phone && (
                <a href={`tel:+91${appt.customer.phone}`} className="text-sm text-stone hover:underline">
                  {formatPhone(appt.customer.phone)}
                </a>
              )}
              {appt.customer.email && <p className="text-sm text-stone">{appt.customer.email}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-stone">Stylist</p>
              <p className="font-medium">{appt.stylist ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-stone">Services</p>
            <ul className="mt-1 divide-y divide-beige rounded-md border border-beige bg-white text-sm">
              {appt.items.map((i, idx) => (
                <li key={idx} className="flex justify-between px-3 py-2">
                  <span>
                    {i.name} <span className="text-xs text-stone">· {formatDuration(i.durationMin)}</span>
                  </span>
                  <span>
                    {formatINR(i.price)}
                    {!i.priceVerified && <span className="ml-1 text-xs text-warning">(unverified)</span>}
                  </span>
                </li>
              ))}
            </ul>
            {appt.customerNotes && <p className="mt-2 text-sm"><span className="text-stone">Customer note:</span> {appt.customerNotes}</p>}
          </div>

          {actions.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {actions
                  .filter((a) => a.to !== "cancelled")
                  .map((a) => (
                    <Button key={a.to} variant={a.variant ?? "primary"} size="sm" loading={busy === STATUS_LABELS[a.to]} onClick={() => patch({ action: "status", status: a.to, note: note || undefined }, STATUS_LABELS[a.to])}>
                      {a.label}
                    </Button>
                  ))}
                {actions.some((a) => a.to === "cancelled") && (
                  <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                    Cancel appointment
                  </Button>
                )}
                {manage && ["pending", "confirmed"].includes(appt.status) && (
                  <Button variant="secondary" size="sm" onClick={() => setReschedule((v) => !v)}>
                    Reschedule / change stylist
                  </Button>
                )}
              </div>
              {confirmCancel && (
                <div className="rounded-md border border-danger/30 bg-[#fbefec] p-3">
                  <Input label="Cancellation reason" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" loading={busy === "Cancelled"} onClick={async () => (await patch({ action: "status", status: "cancelled", note: note || undefined }, "Cancelled")) && setConfirmCancel(false)}>
                      Confirm cancellation
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {reschedule && <ReschedulePanel appt={appt} onDone={async (body) => (await patch(body, "Appointment updated")) && setReschedule(false)} busy={busy === "Appointment updated"} />}

          {(appt.status === "completed" || appt.status === "in_progress" || appt.invoiceId) && can("billing.manage") && (
            <div className="flex items-center gap-3 rounded-md bg-cream p-3 text-sm">
              {data.invoice ? (
                <>
                  <span>
                    Invoice {data.invoice.number} · <StatusBadge status={data.invoice.status} />
                  </span>
                  <Link href={`/dashboard/billing/${data.invoice.id}`} className={buttonClass("secondary", "sm")}>
                    Open invoice
                  </Link>
                </>
              ) : (
                <>
                  <span>Ready to bill this appointment.</span>
                  <Link href={`/dashboard/billing/new?appointment=${appt.id}`} className={buttonClass("primary", "sm")}>
                    Create invoice
                  </Link>
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {(manage || isOwn) && (
              <Textarea label="Service notes" rows={3} value={notes.serviceNotes} onChange={(e) => setNotes({ ...notes, serviceNotes: e.target.value })} maxLength={2000} hint="Formula, products used, technique" />
            )}
            {can("appointments.internal_notes") && (
              <Textarea label="Internal notes (staff only)" rows={3} value={notes.internalNotes} onChange={(e) => setNotes({ ...notes, internalNotes: e.target.value })} maxLength={2000} />
            )}
          </div>
          {(manage || isOwn) && (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "Notes saved"}
              onClick={() => patch({ action: "notes", serviceNotes: notes.serviceNotes, ...(can("appointments.internal_notes") ? { internalNotes: notes.internalNotes } : {}) }, "Notes saved")}
            >
              Save notes
            </Button>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium">History ({appt.history.length})</summary>
            <ol className="mt-2 space-y-1 text-xs text-stone">
              {appt.history.map((h, i) => (
                <li key={i}>
                  {formatDateTime(h.at)} — {STATUS_LABELS[h.status as AppointmentStatus] ?? h.status}
                  {h.byName ? ` by ${h.byName}` : ""}
                  {h.note ? ` · ${h.note}` : ""}
                </li>
              ))}
            </ol>
          </details>
        </div>
      ) : null}
    </Modal>
  );
}

function ReschedulePanel({ appt, onDone, busy }: { appt: StaffAppointment; onDone: (body: Record<string, unknown>) => void; busy: boolean }) {
  const [date, setDate] = useState(dateKeyIST(new Date(appt.start)));
  const [staffId, setStaffId] = useState(appt.staffId);
  const [minutes, setMinutes] = useState<number | null>(null);
  const staff = useApi<{ staff: StaffLite[] }>("/api/admin/staff");
  const serviceIds = appt.serviceIds.join(",");
  const slots = useApi<{ slots: { minutes: number; label: string; staffIds: string[] }[] }>(
    serviceIds ? `/api/admin/appointments/availability${qs({ date, services: serviceIds, staff: staffId, exclude: appt.id })}` : null,
  );
  return (
    <div className="space-y-3 rounded-md border border-beige bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setMinutes(null); }} />
        <Select label="Stylist" value={staffId} onChange={(e) => { setStaffId(e.target.value); setMinutes(null); }}>
          {(staff.data?.staff ?? []).filter((s) => s.bookable && s.active).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {slots.loading ? (
        <Spinner />
      ) : slots.error ? (
        <Alert tone="error">{slots.error.message}</Alert>
      ) : slots.data?.slots.length ? (
        <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
          {slots.data.slots.map((s) => (
            <button key={s.minutes} type="button" aria-pressed={minutes === s.minutes} onClick={() => setMinutes(s.minutes)} className={cx("rounded border py-1.5 text-xs", minutes === s.minutes ? "border-charcoal bg-charcoal text-ivory" : "border-beige hover:border-charcoal")}>
              {s.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone">No free times for this stylist on this date.</p>
      )}
      <Button size="sm" disabled={minutes === null} loading={busy} onClick={() => onDone({ action: staffId !== appt.staffId && dateKeyIST(new Date(appt.start)) === date ? "assign" : "reschedule", date, minutes, staffId })}>
        Save new time
      </Button>
    </div>
  );
}
