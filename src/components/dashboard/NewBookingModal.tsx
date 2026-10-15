"use client";

import { useMemo, useState } from "react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Alert, Button, Checkbox, Input, Modal, Select, Spinner, Textarea, cx } from "@/components/ui";
import type { AdminService, StaffLite } from "./types";
import { dateKeyIST } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { formatDuration, formatPhone } from "@/lib/format";

interface CustomerHit {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export default function NewBookingModal({ open, onClose, onCreated, defaultSource = "walk_in" }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; defaultSource?: "walk_in" | "phone" }) {
  const { can } = useAuth();
  const toast = useToast();
  const services = useApi<{ services: AdminService[]; categories: { id: string; name: string }[] }>(open ? "/api/admin/services" : null);
  const staff = useApi<{ staff: StaffLite[] }>(open ? "/api/admin/staff" : null);
  const [source, setSource] = useState<"walk_in" | "phone">(defaultSource);
  const [selected, setSelected] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(dateKeyIST());
  const [minutes, setMinutes] = useState<number | null>(null);
  const [customer, setCustomer] = useState({ customerId: "", name: "", phone: "", email: "" });
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [checkIn, setCheckIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [filter, setFilter] = useState("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSource(defaultSource);
      setSelected([]);
      setMinutes(null);
      setCustomer({ customerId: "", name: "", phone: "", email: "" });
      setSearch("");
      setNotes("");
      setError(null);
      setDate(dateKeyIST());
    }
  }

  const hits = useApi<{ items: CustomerHit[] }>(open && can("customers.view") && search.trim().length >= 2 ? `/api/admin/customers${qs({ q: search, limit: 6 })}` : null);
  const slots = useApi<{ slots: { minutes: number; label: string; staffIds: string[] }[] }>(
    open && selected.length ? `/api/admin/appointments/availability${qs({ date, services: selected.join(","), staff: staffId })}` : null,
  );

  const list = useMemo(() => (services.data?.services ?? []).filter((s) => s.active && !s.archived && s.name.toLowerCase().includes(filter.toLowerCase())), [services.data, filter]);
  const chosen = (services.data?.services ?? []).filter((s) => selected.includes(s.id));

  async function submit() {
    if (minutes === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ appointment: { id: string; ref: string } }>("/api/admin/appointments", {
        body: {
          source,
          serviceIds: selected,
          staffId: staffId || null,
          date,
          minutes,
          customerId: customer.customerId || undefined,
          name: customer.name,
          phone: customer.phone,
          email: customer.email || undefined,
          notes: notes || undefined,
          checkIn: source === "walk_in" && checkIn && date === dateKeyIST(),
        },
      });
      toast(`Booked ${res.appointment.ref}`);
      onCreated?.(res.appointment.id);
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
      if ((e as ApiClientError).status === 409) slots.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!selected.length || minutes === null || !customer.name || !customer.phone}>
            Create booking
          </Button>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex gap-2" role="group" aria-label="Booking type">
            {(["walk_in", "phone"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)} className={cx("rounded-full border px-4 py-1.5 text-sm", source === s ? "border-charcoal bg-charcoal text-ivory" : "border-sand bg-white")}>
                {s === "walk_in" ? "Walk-in" : "Phone booking"}
              </button>
            ))}
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Customer</legend>
            {can("customers.view") && (
              <div className="relative mb-3">
                <Input label="Find existing customer" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" />
                {hits.data?.items.length ? (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border border-beige bg-white shadow-lg">
                    {hits.data.items.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                          onClick={() => {
                            setCustomer({ customerId: c.id, name: c.name, phone: c.phone, email: c.email });
                            setSearch("");
                          }}
                        >
                          {c.name} <span className="text-stone">· {formatPhone(c.phone)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value, customerId: "" })} />
              <Input label="Mobile" required type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value, customerId: "" })} />
              <Input label="Email" type="email" wrapClassName="sm:col-span-2" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
            </div>
          </fieldset>
          <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          {source === "walk_in" && date === dateKeyIST() && <Checkbox label="Check the customer in now" checked={checkIn} onChange={(e) => setCheckIn(e.target.checked)} />}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Services</p>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter services…" aria-label="Filter services" className="mb-2 w-full rounded-md border border-sand px-3 py-2 text-sm" />
            {services.loading ? (
              <Spinner />
            ) : (
              <ul className="max-h-48 divide-y divide-beige overflow-y-auto rounded-md border border-beige bg-white">
                {list.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-[#85652f]"
                        checked={selected.includes(s.id)}
                        onChange={() => {
                          setSelected((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]));
                          setMinutes(null);
                        }}
                      />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-stone">
                        {formatDuration(s.durationMin)} · {formatINR(s.price)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {chosen.length > 0 && (
              <p className="mt-1 text-xs text-stone">
                {chosen.length} selected · {formatDuration(chosen.reduce((a, s) => a + s.durationMin, 0))} · {formatINR(chosen.reduce((a, s) => a + s.price, 0))}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Date" type="date" min={dateKeyIST()} value={date} onChange={(e) => { setDate(e.target.value); setMinutes(null); }} />
            <Select label="Stylist" value={staffId} onChange={(e) => { setStaffId(e.target.value); setMinutes(null); }}>
              <option value="">Any available</option>
              {(staff.data?.staff ?? []).filter((s) => s.bookable && s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-stone">Choose services to see free times.</p>
          ) : slots.loading ? (
            <Spinner />
          ) : slots.error ? (
            <Alert tone="error">{slots.error.message}</Alert>
          ) : slots.data?.slots.length ? (
            <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5">
              {slots.data.slots.map((s) => (
                <button key={s.minutes} type="button" aria-pressed={minutes === s.minutes} onClick={() => setMinutes(s.minutes)} className={cx("rounded border py-1.5 text-xs", minutes === s.minutes ? "border-charcoal bg-charcoal text-ivory" : "border-beige bg-white hover:border-charcoal")}>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-cream p-3 text-sm text-stone">No free times on this date{staffId ? " for this stylist" : ""}. Try another stylist or date, or add the customer to the queue later.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
