"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Alert, Button, EmptyState, ErrorState, Input, Modal, Select, Spinner, StatusBadge, Textarea, buttonClass, cx } from "@/components/ui";
import Stars from "@/components/site/Stars";
import { addDaysToKey, dateKeyIST, formatDate, formatTime } from "@/lib/time";
import { Star } from "lucide-react";

interface Appt {
  id: string;
  ref: string;
  status: string;
  start: string;
  durationMin: number;
  items: { name: string; price: number; priceVerified: boolean }[];
  estimatedTotal: number;
  stylist: string | null;
  customerNotes: string;
  request: { type: string; at: string } | null;
  invoiceId: string | null;
  reviewed: boolean;
}

interface Data {
  upcoming: Appt[];
  past: Appt[];
  policy: { cancellationCutoffHours: number; rescheduleCutoffHours: number; reviewsEnabled: boolean };
}

export default function AppointmentsTab() {
  const { data, error, loading, reload } = useApi<Data>("/api/account/appointments");
  const [cancelling, setCancelling] = useState<Appt | null>(null);
  const [rescheduling, setRescheduling] = useState<Appt | null>(null);
  const [reviewing, setReviewing] = useState<Appt | null>(null);
  const [now] = useState(() => Date.now());

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const hoursLeft = (a: Appt) => (new Date(a.start).getTime() - now) / 3_600_000;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 font-serif text-xl">Upcoming</h2>
        {data.upcoming.length === 0 ? (
          <EmptyState title="No upcoming appointments" action={<Link href="/book" className={buttonClass("primary")}>Book now</Link>} />
        ) : (
          <ul className="space-y-3">
            {data.upcoming.map((a) => (
              <li key={a.id} className="rounded-lg border border-beige bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg">
                      {formatDate(a.start)} · {formatTime(a.start)}
                    </p>
                    <p className="text-sm text-stone">{a.items.map((i) => i.name).join(", ")}</p>
                    <p className="mt-1 text-xs text-stone">
                      Ref <span className="font-mono">{a.ref}</span>
                      {a.stylist ? ` · with ${a.stylist}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.request ? (
                  <p className="mt-3 rounded bg-cream px-3 py-2 text-xs text-stone">Your {a.request.type} request has been sent to the salon.</p>
                ) : (
                  ["pending", "confirmed"].includes(a.status) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setRescheduling(a)}>
                        Reschedule
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(a)}>
                        Cancel
                      </Button>
                      {hoursLeft(a) < data.policy.cancellationCutoffHours && (
                        <span className="self-center text-xs text-stone">Within {data.policy.cancellationCutoffHours}h of your visit, changes are sent as a request.</span>
                      )}
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl">Past appointments</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-stone">Your past visits will appear here.</p>
        ) : (
          <ul className="divide-y divide-beige rounded-lg border border-beige bg-white">
            {data.past.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {formatDate(a.start)} · {a.items.map((i) => i.name).join(", ")}
                  </p>
                  <p className="text-xs text-stone">
                    Ref {a.ref}
                    {a.stylist ? ` · ${a.stylist}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.invoiceId && (
                    <Link href={`/account/invoices/${a.invoiceId}`} className={buttonClass("ghost", "sm")}>
                      Invoice
                    </Link>
                  )}
                  {a.status === "completed" && data.policy.reviewsEnabled && !a.reviewed && (
                    <Button size="sm" variant="secondary" onClick={() => setReviewing(a)}>
                      <Star size={14} aria-hidden /> Review
                    </Button>
                  )}
                  {a.reviewed && <span className="text-xs text-stone">Reviewed</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cancelling && <CancelModal appt={cancelling} policy={data.policy} onClose={() => setCancelling(null)} onDone={reload} />}
      {rescheduling && <RescheduleModal appt={rescheduling} policy={data.policy} onClose={() => setRescheduling(null)} onDone={reload} />}
      {reviewing && <ReviewModal appt={reviewing} onClose={() => setReviewing(null)} onDone={reload} />}
    </div>
  );
}

function CancelModal({ appt, policy, onClose, onDone }: { appt: Appt; policy: Data["policy"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [late] = useState(() => (new Date(appt.start).getTime() - Date.now()) / 3_600_000 < policy.cancellationCutoffHours);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/account/appointments/${appt.id}`, { body: late ? { action: "request", type: "cancel", reason } : { action: "cancel", reason } });
      toast(late ? "Cancellation request sent to the salon." : "Appointment cancelled.");
      onDone();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={late ? "Request cancellation" : "Cancel appointment"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep appointment
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            {late ? "Send request" : "Cancel appointment"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {formatDate(appt.start)}, {formatTime(appt.start)} — {appt.items.map((i) => i.name).join(", ")}
      </p>
      {late && <Alert tone="warning" className="mt-4">This appointment is within {policy.cancellationCutoffHours} hour(s), so your cancellation will be sent to the salon as a request.</Alert>}
      {error && <Alert tone="error" className="mt-4">{error.message}</Alert>}
      <Textarea label="Reason (optional)" wrapClassName="mt-4" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
    </Modal>
  );
}

function RescheduleModal({ appt, policy, onClose, onDone }: { appt: Appt; policy: Data["policy"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [late] = useState(() => (new Date(appt.start).getTime() - Date.now()) / 3_600_000 < policy.rescheduleCutoffHours);
  const [date, setDate] = useState(addDaysToKey(dateKeyIST(), 1));
  const [minutes, setMinutes] = useState<number | null>(null);
  const [preferred, setPreferred] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const slots = useApi<{ slots: { minutes: number; label: string }[] }>(late ? null : `/api/account/appointments/${appt.id}${qs({ date })}`);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (late) {
        await apiFetch(`/api/account/appointments/${appt.id}`, { body: { action: "request", type: "reschedule", preferredTime: preferred } });
        toast("Reschedule request sent to the salon.");
      } else {
        await apiFetch(`/api/account/appointments/${appt.id}`, { body: { action: "reschedule", date, minutes } });
        toast("Appointment rescheduled.");
      }
      onDone();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
      slots.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={late ? "Request a new time" : "Reschedule appointment"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={submit} loading={busy} disabled={late ? !preferred.trim() : minutes === null}>
            {late ? "Send request" : "Confirm new time"}
          </Button>
        </>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      {late ? (
        <>
          <Alert tone="warning">This appointment is within {policy.rescheduleCutoffHours} hour(s). Tell us when suits you and the salon will get back to you.</Alert>
          <Input label="Preferred date & time" wrapClassName="mt-4" value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="e.g. Saturday after 4 PM" maxLength={200} />
        </>
      ) : (
        <div className="space-y-4">
          <Input label="New date" type="date" min={dateKeyIST()} value={date} onChange={(e) => { setDate(e.target.value); setMinutes(null); }} />
          {slots.loading ? (
            <Spinner />
          ) : slots.error ? (
            <Alert tone="error">{slots.error.message}</Alert>
          ) : slots.data?.slots.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.data.slots.map((s) => (
                <button
                  key={s.minutes}
                  type="button"
                  aria-pressed={minutes === s.minutes}
                  onClick={() => setMinutes(s.minutes)}
                  className={cx("rounded-md border py-2 text-sm", minutes === s.minutes ? "border-charcoal bg-charcoal text-ivory" : "border-beige hover:border-charcoal")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone">No free times on this date. Try another day.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function ReviewModal({ appt, onClose, onDone }: { appt: Appt; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function submit() {
    setBusy(true);
    try {
      await apiFetch("/api/account/reviews", { body: { appointmentId: appt.id, rating, comment } });
      toast("Thank you! Your review will appear once approved.");
      onDone();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Review your visit"
      footer={
        <Button onClick={submit} loading={busy}>
          Submit review
        </Button>
      }
    >
      <p className="text-sm text-stone">{appt.items.map((i) => i.name).join(", ")} on {formatDate(appt.start)}</p>
      {error && <Alert tone="error" className="mt-3">{error.message}</Alert>}
      <Select label="Rating" wrapClassName="mt-4" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
        {[5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>
            {r} star{r > 1 ? "s" : ""}
          </option>
        ))}
      </Select>
      <div className="mt-2">
        <Stars rating={rating} size={22} />
      </div>
      <Textarea label="Your comments" wrapClassName="mt-4" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <p className="mt-2 text-xs text-stone">Reviews show your first name and last initial only.</p>
    </Modal>
  );
}
