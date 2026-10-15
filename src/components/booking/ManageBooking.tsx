"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";
import { Alert, Button, Input, StatusBadge, Textarea } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/time";
import { formatINR } from "@/lib/money";

interface Appt {
  ref: string;
  status: string;
  start: string;
  items: { name: string; price: number; priceVerified: boolean }[];
  stylist: string | null;
  estimatedTotal: number;
  request: { type: string } | null;
}

export default function ManageBooking() {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [appt, setAppt] = useState<Appt | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [policyBlocked, setPolicyBlocked] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ appointment: Appt }>("/api/bookings/lookup", { body: { ref, phone } });
      setAppt(res.appointment);
    } catch (err) {
      setError(err as ApiClientError);
      setAppt(null);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(requestIfLate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ appointment?: Appt; cancelled: boolean; requested?: boolean }>("/api/bookings/lookup/cancel", {
        body: { ref, phone, reason, requestIfLate },
      });
      if (res.cancelled && res.appointment) {
        setAppt(res.appointment);
        setMessage("Your appointment has been cancelled.");
      } else if (res.requested) {
        setMessage("Your cancellation request has been sent to the salon. We'll be in touch.");
        setPolicyBlocked(false);
      }
    } catch (err) {
      const e = err as ApiClientError;
      if (e.code === "policy") setPolicyBlocked(true);
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const active = appt && ["pending", "confirmed"].includes(appt.status);

  return (
    <div className="space-y-6">
      <form onSubmit={lookup} className="space-y-4 rounded-xl border border-beige bg-white p-6">
        <Input label="Booking reference" required value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="e.g. VGAB12CD" maxLength={12} autoComplete="off" />
        <Input label="Mobile number" required type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        <Button type="submit" loading={busy && !appt}>
          Find my booking
        </Button>
        <p className="text-xs text-stone">
          Have an account? <Link href="/login?next=/account" className="text-gold-deep underline">Sign in</Link> to see all your bookings.
        </p>
      </form>

      {error && <Alert tone="error">{error.message}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {appt && (
        <div className="rounded-xl border border-beige bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-lg font-semibold">{appt.ref}</p>
            <StatusBadge status={appt.status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone">When</dt>
              <dd>
                {formatDate(appt.start)}, {formatTime(appt.start)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone">Services</dt>
              <dd className="text-right">{appt.items.map((i) => i.name).join(", ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone">Stylist</dt>
              <dd>{appt.stylist ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone">Estimated</dt>
              <dd>{formatINR(appt.items.filter((i) => i.priceVerified).reduce((s, i) => s + i.price, 0))}{appt.items.some((i) => !i.priceVerified) ? " + items priced at salon" : ""}</dd>
            </div>
          </dl>
          {appt.request && <p className="mt-4 text-sm text-stone">A {appt.request.type} request is pending with the salon.</p>}
          {active && (
            <div className="mt-6 space-y-3 border-t border-beige pt-5">
              <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" loading={busy} onClick={() => cancel(false)}>
                  Cancel appointment
                </Button>
                {policyBlocked && (
                  <Button variant="secondary" loading={busy} onClick={() => cancel(true)}>
                    Send cancellation request instead
                  </Button>
                )}
              </div>
              <p className="text-xs text-stone">
                To move this appointment, cancel it and <Link href="/book" className="underline">book a new time</Link>, or contact the salon.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
