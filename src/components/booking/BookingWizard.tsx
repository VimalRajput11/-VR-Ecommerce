"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Clock, CalendarDays, User, Download } from "lucide-react";
import type { PublicCategory, PublicService } from "@/server/queries/public";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, Checkbox, Input, Spinner, Textarea, buttonClass, cx } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/format";
import { addDaysToKey, dateKeyIST, formatDateKey, formatLongDateKey, formatTime, formatDate, weekdayName, weekdayOfDateKey } from "@/lib/time";

interface WizardSettings {
  staffSelectionEnabled: boolean;
  guestBookingEnabled: boolean;
  requireEmail: boolean;
  maxAdvanceDays: number;
  cancellationCutoffHours: number;
  payments: { cash?: boolean | null; upi?: boolean | null; card?: boolean | null; online?: boolean };
  name: string;
}

type Step = "services" | "addons" | "stylist" | "time" | "details" | "review" | "done";

interface Slot {
  minutes: number;
  label: string;
  start: string;
}

interface Booked {
  id: string;
  ref: string;
  status: string;
  start: string;
  end: string;
  items: { name: string; price: number; priceVerified: boolean }[];
  estimatedTotal: number;
  stylist: string | null;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function icsFor(b: Booked, salon: string) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VG Unisex Salon//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.ref}@vg-unisex-saloon`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(b.start)}`,
    `DTEND:${fmt(b.end)}`,
    `SUMMARY:${salon} – ${b.items.map((i) => i.name).join(", ")}`,
    `DESCRIPTION:Booking reference ${b.ref}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export default function BookingWizard({
  categories,
  services,
  settings,
  initialServiceId,
}: {
  categories: PublicCategory[];
  services: PublicService[];
  settings: WizardSettings;
  initialServiceId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const main = services.filter((s) => s.kind !== "addon");
  const addons = services.filter((s) => s.kind === "addon");

  const [step, setStep] = useState<Step>("services");
  const [selected, setSelected] = useState<string[]>(() => (initialServiceId && services.some((s) => s.id === initialServiceId) ? [initialServiceId] : []));
  const [staffId, setStaffId] = useState<string>("");
  const [date, setDate] = useState(dateKeyIST());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState({ name: "", phone: "", email: "", notes: "" });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [idemKey] = useState(newKey);
  const [openCat, setOpenCat] = useState<string>(() => services.find((s) => s.id === initialServiceId)?.categoryId ?? categories[0]?.id ?? "");

  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setDetails((d) => ({ ...d, name: d.name || user.name, phone: d.phone || user.phone || "", email: d.email || user.email || "" }));
  }

  const chosen = useMemo(() => selected.map((id) => services.find((s) => s.id === id)).filter(Boolean) as PublicService[], [selected, services]);
  const duration = chosen.reduce((s, x) => s + x.durationMin, 0);
  const knownTotal = chosen.reduce((s, x) => s + (x.price ?? 0), 0);
  const hasUnpriced = chosen.some((x) => x.price === null);
  const hasFrom = chosen.some((x) => x.priceFrom);
  const serviceParam = selected.join(",");

  const staff = useApi<{ staff: { id: string; name: string; title: string }[]; selectionEnabled: boolean }>(
    settings.staffSelectionEnabled && serviceParam && (step === "stylist" || step === "time") ? `/api/public/staff${qs({ services: serviceParam })}` : null,
  );
  const availability = useApi<{ slots: Slot[]; reason: string | null }>(
    step === "time" && serviceParam ? `/api/public/availability${qs({ date, services: serviceParam, staff: staffId })}` : null,
  );

  const steps: { id: Step; label: string; show: boolean }[] = [
    { id: "services", label: "Services", show: true },
    { id: "addons", label: "Add-ons", show: addons.length > 0 },
    { id: "stylist", label: "Stylist", show: settings.staffSelectionEnabled },
    { id: "time", label: "Date & time", show: true },
    { id: "details", label: "Your details", show: true },
    { id: "review", label: "Review", show: true },
  ];
  const visible = steps.filter((s) => s.show);
  const index = visible.findIndex((s) => s.id === step);
  const go = (dir: 1 | -1) => {
    const next = visible[index + dir];
    if (next) {
      setError(null);
      setStep(next.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggle = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSlot(null);
  };

  const dates = Array.from({ length: Math.min(settings.maxAdvanceDays + 1, 21) }, (_, i) => addDaysToKey(dateKeyIST(), i));
  const maxDate = addDaysToKey(dateKeyIST(), settings.maxAdvanceDays);

  const phoneOk = /^(\+?91|0)?[6-9]\d{9}$/.test(details.phone.replace(/[\s-]/g, ""));
  const emailOk = !details.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(details.email);
  const detailsValid = details.name.trim().length > 0 && phoneOk && emailOk && (!settings.requireEmail || !!details.email);
  const needsLogin = !user && !settings.guestBookingEnabled;

  const canContinue =
    (step === "services" && selected.length > 0) ||
    step === "addons" ||
    step === "stylist" ||
    (step === "time" && !!slot) ||
    (step === "details" && detailsValid && !needsLogin);

  async function confirm() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ appointment: Booked }>("/api/bookings", {
        body: {
          serviceIds: selected,
          staffId: staffId || null,
          date,
          minutes: slot.minutes,
          name: details.name,
          phone: details.phone,
          email: details.email || undefined,
          notes: details.notes || undefined,
          paymentPreference: "pay_at_salon",
          idempotencyKey: idemKey,
        },
      });
      setBooked(res.appointment);
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const e = err as ApiClientError;
      setError(e);
      if (e.status === 409) {
        setSlot(null);
        setStep("time");
        availability.reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!main.length) {
    return <p className="mt-6 rounded-md border border-sand bg-white p-4 text-stone">No services are available to book online right now. Please contact the salon.</p>;
  }

  if (step === "done" && booked) {
    return (
      <div className="mt-8 rounded-xl border border-beige bg-white p-6 md:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5ef] text-success">
          <Check size={28} aria-hidden />
        </div>
        <h2 className="mt-5 font-serif text-3xl">{booked.status === "confirmed" ? "Your appointment is confirmed" : "Booking request received"}</h2>
        <p className="mt-2 text-stone">
          {booked.status === "confirmed"
            ? "We look forward to seeing you."
            : "The salon will confirm your appointment shortly. Your time is held for you in the meantime."}
        </p>
        <div className="mt-6 inline-block rounded-lg border-2 border-dashed border-gold bg-cream px-6 py-4">
          <p className="text-xs uppercase tracking-widest text-stone">Booking reference</p>
          <p className="font-mono text-3xl font-semibold tracking-wider">{booked.ref}</p>
        </div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone">Date &amp; time</dt>
            <dd className="font-medium">
              {formatDate(booked.start)}, {formatTime(booked.start)}
            </dd>
          </div>
          <div>
            <dt className="text-stone">Stylist</dt>
            <dd className="font-medium">{booked.stylist ?? "Assigned at the salon"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-stone">Services</dt>
            <dd className="font-medium">{booked.items.map((i) => i.name).join(", ")}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-stone">
          Please keep your reference. You can manage this booking {user ? "from your account" : "using your reference and mobile number"}. Payment is taken at the salon.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(booked, settings.name))}`}
            download={`${booked.ref}.ics`}
            className={buttonClass("secondary")}
          >
            <Download size={16} aria-hidden /> Add to calendar
          </a>
          <Link href={user ? "/account" : "/booking/manage"} className={buttonClass("primary")}>
            {user ? "View my appointments" : "Manage booking"}
          </Link>
          <Link href="/" className={buttonClass("ghost")}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <ol className="hide-scrollbar mb-6 flex gap-2 overflow-x-auto text-xs" aria-label="Booking steps">
          {visible.map((s, i) => (
            <li
              key={s.id}
              aria-current={s.id === step ? "step" : undefined}
              className={cx(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5",
                i < index ? "bg-charcoal/10 text-charcoal" : s.id === step ? "bg-charcoal text-ivory" : "bg-white text-stone",
              )}
            >
              <span className="font-semibold">{i + 1}</span> {s.label}
            </li>
          ))}
        </ol>

        {error && step !== "details" && (
          <Alert tone="error" className="mb-4">
            {error.message}
          </Alert>
        )}

        <div className="rounded-xl border border-beige bg-white p-5 md:p-7">
          {step === "services" && (
            <div>
              <h2 className="font-serif text-2xl">Choose your services</h2>
              <p className="mt-1 text-sm text-stone">Select one or more. You can combine services in one visit.</p>
              <div className="mt-6 space-y-3">
                {categories.map((c) => {
                  const items = main.filter((s) => s.categoryId === c.id);
                  if (!items.length) return null;
                  const count = items.filter((s) => selected.includes(s.id)).length;
                  const open = openCat === c.id;
                  return (
                    <div key={c.id} className="rounded-lg border border-beige">
                      <button type="button" onClick={() => setOpenCat(open ? "" : c.id)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-stone">{count ? `${count} selected` : `${items.length} services`}</span>
                      </button>
                      {open && (
                        <ul className="divide-y divide-beige border-t border-beige">
                          {items.map((s) => {
                            const on = selected.includes(s.id);
                            return (
                              <li key={s.id}>
                                <label className={cx("flex cursor-pointer items-start gap-3 px-4 py-3", on && "bg-cream/70")}>
                                  <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-1 h-4 w-4 accent-[#85652f]" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-medium">{s.name}</span>
                                    <span className="text-xs text-stone">
                                      {formatDuration(s.durationMin)}
                                      {s.description ? ` · ${s.description}` : ""}
                                    </span>
                                  </span>
                                  <span className="whitespace-nowrap text-sm">
                                    {s.price === null ? <span className="text-stone">At salon</span> : `${s.priceFrom ? "from " : ""}${formatINR(s.price)}`}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "addons" && (
            <div>
              <h2 className="font-serif text-2xl">Add something extra?</h2>
              <p className="mt-1 text-sm text-stone">Optional add-ons for your visit.</p>
              <ul className="mt-6 divide-y divide-beige rounded-lg border border-beige">
                {addons.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[#85652f]" />
                      <span className="min-w-0 flex-1">
                        {s.name} <span className="text-xs text-stone">· {formatDuration(s.durationMin)}</span>
                      </span>
                      <span className="text-sm">{s.price === null ? "At salon" : formatINR(s.price)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "stylist" && (
            <div>
              <h2 className="font-serif text-2xl">Choose a stylist</h2>
              <p className="mt-1 text-sm text-stone">Pick your preferred stylist, or choose any available for the most times.</p>
              {staff.loading ? (
                <Spinner />
              ) : staff.error ? (
                <Alert tone="error" className="mt-4">{staff.error.message}</Alert>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[{ id: "", name: "Any available stylist", title: "First free stylist for your time" }, ...(staff.data?.staff ?? [])].map((m) => (
                    <button
                      key={m.id || "any"}
                      type="button"
                      onClick={() => {
                        setStaffId(m.id);
                        setSlot(null);
                      }}
                      aria-pressed={staffId === m.id}
                      className={cx("flex items-center gap-3 rounded-lg border p-4 text-left transition-colors", staffId === m.id ? "border-charcoal bg-cream" : "border-beige hover:border-sand")}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-charcoal text-gold">
                        <User size={18} aria-hidden />
                      </span>
                      <span>
                        <span className="block font-medium">{m.name}</span>
                        {m.title && <span className="text-xs text-stone">{m.title}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!staff.loading && staff.data && staff.data.staff.length === 0 && (
                <p className="mt-4 text-sm text-stone">No individual stylists are listed for this combination; we&apos;ll assign the first available.</p>
              )}
            </div>
          )}

          {step === "time" && (
            <div>
              <h2 className="font-serif text-2xl">Pick a date &amp; time</h2>
              <p className="mt-1 text-sm text-stone">All times are Indian Standard Time.</p>
              <div className="hide-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Choose date">
                {dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDate(d);
                      setSlot(null);
                    }}
                    aria-pressed={date === d}
                    className={cx("flex min-w-[64px] flex-col items-center rounded-lg border px-3 py-2", date === d ? "border-charcoal bg-charcoal text-ivory" : "border-beige bg-white hover:border-sand")}
                  >
                    <span className="text-[11px] uppercase">{weekdayName(weekdayOfDateKey(d), true)}</span>
                    <span className="font-serif text-xl">{d.slice(8)}</span>
                    <span className="text-[11px]">{formatDateKey(d).slice(3, 5)}</span>
                  </button>
                ))}
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-stone">
                <CalendarDays size={16} aria-hidden /> Or choose a date:
                <input
                  type="date"
                  value={date}
                  min={dateKeyIST()}
                  max={maxDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDate(e.target.value);
                      setSlot(null);
                    }
                  }}
                  className="rounded-md border border-sand px-2 py-1 text-charcoal"
                />
              </label>
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium">{formatLongDateKey(date)}</p>
                {availability.loading ? (
                  <Spinner label="Checking availability…" />
                ) : availability.error ? (
                  <Alert tone="error">{availability.error.message}</Alert>
                ) : availability.data?.slots.length ? (
                  (["Morning", "Afternoon", "Evening"] as const).map((part) => {
                    const list = availability.data!.slots.filter((s) => (part === "Morning" ? s.minutes < 720 : part === "Afternoon" ? s.minutes >= 720 && s.minutes < 1020 : s.minutes >= 1020));
                    if (!list.length) return null;
                    return (
                      <div key={part} className="mb-4">
                        <p className="mb-2 text-xs uppercase tracking-wider text-stone">{part}</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {list.map((s) => (
                            <button
                              key={s.minutes}
                              type="button"
                              onClick={() => setSlot(s)}
                              aria-pressed={slot?.minutes === s.minutes}
                              className={cx("rounded-md border py-2 text-sm", slot?.minutes === s.minutes ? "border-charcoal bg-charcoal text-ivory" : "border-beige hover:border-charcoal")}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-md bg-cream p-4 text-sm text-stone">{availability.data?.reason ?? "No times available on this date. Please try another day."}</p>
                )}
              </div>
            </div>
          )}

          {step === "details" && (
            <div>
              <h2 className="font-serif text-2xl">Your details</h2>
              {needsLogin ? (
                <Alert tone="info" className="mt-4">
                  Please <Link href="/login?next=/book" className="underline">sign in</Link> or <Link href="/register?next=/book" className="underline">create an account</Link> to book.
                </Alert>
              ) : (
                <>
                  {!user && !authLoading && (
                    <p className="mt-1 text-sm text-stone">
                      Have an account? <Link href="/login?next=/book" className="text-gold-deep underline">Sign in</Link> to keep all your bookings in one place — or continue as a guest.
                    </p>
                  )}
                  {error && (
                    <Alert tone="error" className="mt-4">
                      {error.message}
                    </Alert>
                  )}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Input label="Full name" required autoComplete="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} maxLength={100} />
                    <Input
                      label="Mobile number"
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={details.phone}
                      onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                      hint="10-digit Indian mobile number"
                      error={details.phone && !phoneOk ? "Enter a valid 10-digit mobile number." : null}
                    />
                    <Input
                      label="Email"
                      required={settings.requireEmail}
                      type="email"
                      autoComplete="email"
                      value={details.email}
                      onChange={(e) => setDetails({ ...details, email: e.target.value })}
                      hint={settings.requireEmail ? undefined : "Optional — for your confirmation"}
                      error={details.email && !emailOk ? "Enter a valid email." : null}
                      wrapClassName="sm:col-span-2"
                    />
                    <Textarea
                      label="Notes for the salon"
                      value={details.notes}
                      onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                      maxLength={500}
                      rows={3}
                      hint="Optional — e.g. hair length, allergies, or preferences"
                      wrapClassName="sm:col-span-2"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === "review" && slot && (
            <div>
              <h2 className="font-serif text-2xl">Review &amp; confirm</h2>
              <dl className="mt-6 divide-y divide-beige text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-stone">Date &amp; time</dt>
                  <dd className="text-right font-medium">
                    {formatLongDateKey(date)}, {slot.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-stone">Duration</dt>
                  <dd className="font-medium">{formatDuration(duration)}</dd>
                </div>
                {settings.staffSelectionEnabled && (
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-stone">Stylist</dt>
                    <dd className="font-medium">{staff.data?.staff.find((m) => m.id === staffId)?.name ?? "Any available"}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-stone">Name</dt>
                  <dd className="font-medium">{details.name}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-stone">Mobile</dt>
                  <dd className="font-medium">{details.phone}</dd>
                </div>
              </dl>
              <div className="mt-6 rounded-lg bg-cream p-4">
                <p className="text-sm font-medium">Payment</p>
                <p className="mt-1 text-sm text-stone">
                  Pay at the salon after your service
                  {[settings.payments.cash && "cash", settings.payments.upi && "UPI", settings.payments.card && "card"].filter(Boolean).length
                    ? ` by ${[settings.payments.cash && "cash", settings.payments.upi && "UPI", settings.payments.card && "card"].filter(Boolean).join(", ")}`
                    : ""}
                  .{settings.payments.online ? " You can also pay online from your account once your invoice is issued." : ""}
                </p>
              </div>
              <Checkbox
                className="mt-5"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                label={
                  <>
                    I agree to the{" "}
                    <Link href="/policies" target="_blank" className="text-gold-deep underline">
                      booking &amp; cancellation policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="text-gold-deep underline">
                      privacy policy
                    </Link>
                    .
                  </>
                }
                hint={settings.cancellationCutoffHours ? `Free online cancellation up to ${settings.cancellationCutoffHours} hour(s) before your appointment.` : undefined}
              />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-beige pt-5">
            {index > 0 ? (
              <Button variant="ghost" onClick={() => go(-1)}>
                <ChevronLeft size={16} aria-hidden /> Back
              </Button>
            ) : (
              <span />
            )}
            {step === "review" ? (
              <Button size="lg" onClick={confirm} loading={submitting} disabled={!agree}>
                Confirm booking
              </Button>
            ) : (
              <Button size="lg" onClick={() => go(1)} disabled={!canContinue}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-beige bg-white p-5 lg:sticky lg:top-24" aria-label="Booking summary">
        <h2 className="font-serif text-lg">Your booking</h2>
        {chosen.length ? (
          <ul className="mt-4 space-y-2 text-sm">
            {chosen.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span>{s.name}</span>
                <span className="whitespace-nowrap text-stone">{s.price === null ? "At salon" : `${s.priceFrom ? "from " : ""}${formatINR(s.price)}`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone">No services selected yet.</p>
        )}
        {chosen.length > 0 && (
          <div className="mt-4 space-y-1 border-t border-beige pt-4 text-sm">
            <p className="flex items-center gap-1.5 text-stone">
              <Clock size={14} aria-hidden /> {formatDuration(duration)}
            </p>
            {slot && (
              <p className="flex items-center gap-1.5 text-stone">
                <CalendarDays size={14} aria-hidden /> {formatLongDateKey(date)}, {slot.label}
              </p>
            )}
            <p className="flex justify-between pt-2 font-medium">
              <span>Estimated total</span>
              <span>{knownTotal > 0 ? `${hasFrom ? "from " : ""}${formatINR(knownTotal)}` : "—"}</span>
            </p>
            {(hasUnpriced || hasFrom) && <p className="text-xs text-stone">Final price is confirmed at the salon{hasUnpriced ? " for services marked “at salon”" : ""}.</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
