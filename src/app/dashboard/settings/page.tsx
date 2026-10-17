"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Button, Card, Checkbox, Input, PageHeader, Spinner, Tabs, Textarea } from "@/components/ui";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { weekdayName } from "@/lib/time";

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = any;

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="text-success" aria-hidden /> : <XCircle size={16} className="text-stone" aria-hidden />}
      {label}: {ok ? "configured" : "not configured"}
    </li>
  );
}

type Tab = "business" | "hours" | "booking" | "payments" | "features" | "notifications";

export default function SettingsPage() {
  return (
    <RequirePermission any={["settings.manage"]}>
      <Settings />
    </RequirePermission>
  );
}

function Settings() {
  const toast = useToast();
  const { data, error, loading } = useApi<{ settings: S; integrations: Record<string, boolean> }>("/api/admin/settings");
  const [s, setS] = useState<S | null>(null);
  const [tab, setTab] = useState<Tab>("business");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<ApiClientError | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<typeof data>(null);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setS(structuredClone(data.settings));
  }

  if (loading && !s) return <Spinner />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!s || !data) return null;

  const set = (path: string, value: unknown) =>
    setS((cur: S) => {
      const next = structuredClone(cur);
      const keys = path.split(".");
      let o = next;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      o[keys[keys.length - 1]] = value;
      return next;
    });
  const txt = (path: string, label: string, extra: Record<string, unknown> = {}) => (
    <Input label={label} value={path.split(".").reduce((o: S, k) => o?.[k], s) ?? ""} onChange={(e) => set(path, e.target.value)} {...extra} />
  );
  const num = (path: string, label: string, extra: Record<string, unknown> = {}) => (
    <Input label={label} type="number" value={path.split(".").reduce((o: S, k) => o?.[k], s) ?? 0} onChange={(e) => set(path, Number(e.target.value))} {...extra} />
  );
  const chk = (path: string, label: string, hint?: string) => (
    <Checkbox label={label} hint={hint} checked={!!path.split(".").reduce((o: S, k) => o?.[k], s)} onChange={(e) => set(path, e.target.checked)} />
  );

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await apiFetch<{ settings: S }>("/api/admin/settings", { method: "PATCH", body: s });
      setS(structuredClone(res.settings));
      toast("Settings saved.");
    } catch (e) {
      setSaveError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  const integ = data.integrations;

  return (
    <div>
      <PageHeader title="Settings" description="Everything about your single salon location." actions={<Button onClick={save} loading={busy}>Save changes</Button>} />
      {saveError && <Alert tone="error" className="mb-4">{saveError.message}{saveError.field ? ` (${saveError.field})` : ""}</Alert>}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "business", label: "Business & contact" },
          { id: "hours", label: "Opening hours" },
          { id: "booking", label: "Booking & policies" },
          { id: "payments", label: "Payments, tax & invoices" },
          { id: "features", label: "Features & loyalty" },
          { id: "notifications", label: "Notifications & integrations" },
        ]}
      />

      {tab === "business" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Business">
            <div className="space-y-4">
              {txt("name", "Business name")}
              {txt("tagline", "Tagline")}
              <Textarea label="About text (About page)" rows={5} value={s.about ?? ""} onChange={(e) => set("about", e.target.value)} hint="Leave empty to use the default text." />
              {txt("homepage.announcement", "Announcement bar (optional)", { hint: "Shown at the top of every page, e.g. a festival notice." })}
            </div>
          </Card>
          <Card title="Contact details">
            <div className="space-y-4">
              {txt("contact.phone", "Phone", { type: "tel" })}
              {txt("contact.whatsapp", "WhatsApp number", { type: "tel" })}
              {txt("contact.email", "Email", { type: "email" })}
              {chk("contact.verified", "These contact details are verified — show them on the website")}
            </div>
          </Card>
          <Card title="Address">
            <div className="space-y-4">
              {txt("address.line1", "Street / shop number")}
              {txt("address.locality", "Locality")}
              <div className="grid grid-cols-2 gap-3">
                {txt("address.city", "City")}
                {txt("address.postalCode", "PIN code")}
              </div>
              {txt("address.mapUrl", "Google Maps link (https://…)")}
              {txt("address.mapCoords", "Map location (latitude, longitude)", {
                placeholder: "e.g. 28.6402, 77.1856",
                hint: "Pins the website map exactly. In Google Maps, long-press your shop, then copy the numbers shown at the top.",
              })}
              {chk("address.verified", "Full address is verified — show street, PIN and map link")}
            </div>
          </Card>
          <Card title="Social media">
            <div className="space-y-4">
              {txt("socials.instagram", "Instagram URL")}
              {txt("socials.facebook", "Facebook URL")}
            </div>
          </Card>
        </div>
      )}

      {tab === "hours" && (
        <Card title="Opening hours (IST)">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = s.hours[d];
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 font-medium">{weekdayName(d)}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" className="accent-[#85652f]" checked={!h.closed} onChange={(e) => set(`hours.${d}.closed`, !e.target.checked)} /> Open
                  </label>
                  {!h.closed && (
                    <>
                      <input type="time" aria-label={`${weekdayName(d)} opens`} value={h.open} onChange={(e) => set(`hours.${d}.open`, e.target.value)} className="rounded border border-sand px-2 py-1" />–
                      <input type="time" aria-label={`${weekdayName(d)} closes`} value={h.close} onChange={(e) => set(`hours.${d}.close`, e.target.value)} className="rounded border border-sand px-2 py-1" />
                      {(h.breaks ?? []).map((b: { start: string; end: string }, i: number) => (
                        <span key={i} className="flex items-center gap-1 rounded bg-cream px-2 py-1">
                          Break
                          <input type="time" aria-label="Break start" value={b.start} onChange={(e) => set(`hours.${d}.breaks.${i}.start`, e.target.value)} className="rounded border border-sand px-1" />–
                          <input type="time" aria-label="Break end" value={b.end} onChange={(e) => set(`hours.${d}.breaks.${i}.end`, e.target.value)} className="rounded border border-sand px-1" />
                          <button type="button" aria-label="Remove break" className="text-danger" onClick={() => set(`hours.${d}.breaks`, h.breaks.filter((_: unknown, j: number) => j !== i))}>
                            ×
                          </button>
                        </span>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => set(`hours.${d}.breaks`, [...(h.breaks ?? []), { start: "14:00", end: "14:30" }])}>
                        + break
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5">{chk("hoursVerified", "These hours are confirmed — show them on the website", "Booking always uses these hours; the website only displays them once confirmed.")}</div>
          <p className="mt-3 text-xs text-stone">Holidays and one-off closures are managed under Staff &amp; hours.</p>
        </Card>
      )}

      {tab === "booking" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Booking rules">
            <div className="space-y-4">
              {chk("booking.onlineEnabled", "Online booking is open")}
              {chk("booking.guestBookingEnabled", "Allow booking without an account")}
              {chk("booking.staffSelectionEnabled", "Let customers choose their stylist")}
              {chk("booking.autoConfirm", "Confirm online bookings automatically", "Otherwise they stay Pending until you confirm.")}
              {chk("booking.requireEmail", "Require an email address")}
              <div className="grid grid-cols-2 gap-3">
                {num("booking.slotIntervalMin", "Slot interval (min)", { min: 5, max: 60 })}
                {num("booking.minLeadMinutes", "Minimum notice (min)", { min: 0 })}
                {num("booking.maxAdvanceDays", "Book up to (days ahead)", { min: 1, max: 365 })}
                {num("booking.cancellationCutoffHours", "Online cancel cut-off (hours)", { min: 0, max: 168 })}
                {num("booking.rescheduleCutoffHours", "Online reschedule cut-off (hours)", { min: 0, max: 168 })}
              </div>
            </div>
          </Card>
          <Card title="Policies (shown on the Policies page)">
            <div className="space-y-4">
              <Textarea label="Booking policy" rows={6} value={s.policies?.booking ?? ""} onChange={(e) => set("policies.booking", e.target.value)} hint="Leave empty to use the default text generated from your rules." />
              <Textarea label="Cancellation & rescheduling policy" rows={6} value={s.policies?.cancellation ?? ""} onChange={(e) => set("policies.cancellation", e.target.value)} />
            </div>
          </Card>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Payment methods">
            <div className="space-y-3">
              {chk("payments.cash", "Cash")}
              {chk("payments.upi", "UPI")}
              {s.payments?.upi && txt("payments.upiId", "Salon UPI ID (shown at billing)")}
              {chk("payments.card", "Card (via your card machine)")}
              {chk("payments.online", "Online payments via Razorpay", integ.onlinePayments ? "Gateway keys detected." : "Requires RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the server — stays off until configured.")}
            </div>
          </Card>
          <Card title="Tax">
            <div className="space-y-3">
              {chk("tax.enabled", "Charge tax on invoices", "Confirm your GST registration and rate with your accountant.")}
              {s.tax?.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {txt("tax.name", "Tax name")}
                    <Input label="Rate (%)" type="number" step="0.01" min={0} max={50} value={(s.tax?.rateBps ?? 0) / 100} onChange={(e) => set("tax.rateBps", Math.round(Number(e.target.value) * 100))} />
                  </div>
                  {chk("tax.inclusive", "Prices already include tax")}
                  {txt("tax.gstin", "GSTIN", { hint: "15 characters, shown on invoices" })}
                </>
              )}
            </div>
          </Card>
          <Card title="Invoices">
            <div className="space-y-3">
              {txt("invoice.prefix", "Invoice number prefix", { hint: "e.g. VG → VG-2026-00001" })}
              {txt("invoice.footerNote", "Footer note")}
            </div>
          </Card>
          <Card title="Discount limits">
            {num("discounts.receptionistMaxPercent", "Max manual discount for receptionists (%)", { min: 0, max: 100 })}
          </Card>
        </div>
      )}

      {tab === "features" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Optional features">
            <div className="space-y-3">
              {chk("features.staffAccounts", "Staff accounts (receptionists & stylists)")}
              {chk("features.reviews", "Customer reviews")}
              {chk("features.inventory", "Inventory tracking")}
              {chk("features.retail", "Sell retail products at billing")}
              {chk("features.loyalty", "Loyalty points")}
            </div>
            <p className="mt-4 text-xs text-stone">Memberships, gift cards and referral credit are not built yet. Referral and seasonal discounts can be run as coupon codes under Offers.</p>
          </Card>
          {s.features?.loyalty && (
            <Card title="Loyalty rules">
              <div className="space-y-3">
                {num("loyalty.pointsPer100", "Points earned per ₹100 paid", { min: 0, max: 100 })}
                <Input label="Value of 1 point (₹)" type="number" step="0.01" min={0} value={paiseToRupees(s.loyalty?.pointValuePaise ?? 0)} onChange={(e) => set("loyalty.pointValuePaise", rupeesToPaise(Number(e.target.value)))} />
                {num("loyalty.minRedeemPoints", "Minimum points to redeem", { min: 0 })}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Customer notifications">
            <div className="space-y-3">
              {chk("notifications.email", "Email", integ.email ? "Email provider configured." : "Email provider not configured yet — messages are logged as skipped.")}
              {chk("notifications.sms", "SMS", "No SMS provider is connected yet.")}
              {chk(
                "notifications.whatsapp",
                "WhatsApp: send invoices automatically",
                integ.whatsapp
                  ? "WhatsApp Business API connected. Each new invoice is sent to the customer's mobile."
                  : "WhatsApp Business API not connected yet. You can still send invoices and offers with the \"Send on WhatsApp\" buttons.",
              )}
              {num("notifications.reminderHoursBefore", "Send reminders this many hours before", { min: 1, max: 72 })}
            </div>
            <p className="mt-3 text-xs text-stone">In-app notifications are always sent to customers with accounts. Customers can opt out of each channel from their profile.</p>
          </Card>
          <Card title="Integrations status">
            <ul className="space-y-2">
              <Status ok={integ.onlinePayments} label="Razorpay payments" />
              <Status ok={integ.paymentWebhook} label="Razorpay webhook" />
              <Status ok={integ.email} label="Email (Resend)" />
              <Status ok={integ.sms} label="SMS" />
              <Status ok={integ.whatsapp} label="WhatsApp" />
              <Status ok={integ.cron} label="Reminder scheduler secret" />
            </ul>
            <p className="mt-3 text-xs text-stone">Credentials are set as server environment variables (see README); they are never stored in the database.</p>
          </Card>
        </div>
      )}
      <div className="mt-6">
        <Button onClick={save} loading={busy}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
