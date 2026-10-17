"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Alert, Badge, Button, EmptyState, Modal, Select, Spinner, Textarea, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { formatPhone } from "@/lib/format";

interface Recipient {
  id: string;
  name: string;
  phone: string;
  lastVisitAt: string;
  marketingConsent: boolean;
  status: "pending" | "sent" | "failed" | "skipped" | null;
  error: string | null;
  sentAt: string | null;
}

interface Resp {
  message: string;
  apiConfigured: boolean;
  recipients: Recipient[];
}

const PERIODS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
  { days: 0, label: "Any time" },
];

// First name, capitalised ("vimal rajput" → "Vimal"), used for {name} in the message.
const firstName = (name: string) => {
  const first = name.trim().split(/\s+/)[0];
  return first ? first[0].toUpperCase() + first.slice(1) : "there";
};
const waHref = (phone: string, text: string) => `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;

/** Sends an offer to customers who have visited the salon, one tap each or in bulk via the Business API. */
export default function WhatsAppOfferModal({ coupon, onClose }: { coupon: { id: string; code: string; title: string }; onClose: () => void }) {
  const toast = useToast();
  const [days, setDays] = useState(90);
  const { data, error, loading, setData, reload } = useApi<Resp>(`/api/admin/coupons/${coupon.id}/whatsapp?days=${days}`);
  const [message, setMessage] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ sent: number; failed: number; running: boolean } | null>(null);
  const [bulkError, setBulkError] = useState<ApiClientError | null>(null);

  const text = message ?? data?.message ?? "";
  const list = data?.recipients ?? [];
  const sentCount = list.filter((r) => r.status === "sent").length;
  const optedInPending = (data?.recipients ?? []).filter((r) => r.marketingConsent && !r.status).length;

  function opened(r: Recipient) {
    // Optimistically mark as sent; the server records it so it survives a reload.
    setData((d) => (d ? { ...d, recipients: d.recipients.map((x) => (x.id === r.id ? { ...x, status: "sent", sentAt: new Date().toISOString() } : x)) } : d));
    apiFetch(`/api/admin/coupons/${coupon.id}/whatsapp`, { body: { action: "opened", customerId: r.id, message: text } }).catch(() => undefined);
  }

  async function sendAll() {
    setBulkError(null);
    let total = { sent: 0, failed: 0 };
    setBulk({ ...total, running: true });
    try {
      for (;;) {
        const res = await apiFetch<{ sent: number; failed: number; remaining: number }>(`/api/admin/coupons/${coupon.id}/whatsapp`, { body: { action: "send", days } });
        total = { sent: total.sent + res.sent, failed: total.failed + res.failed };
        setBulk({ ...total, running: true });
        if (!res.remaining || res.sent + res.failed === 0) break;
      }
      toast(`Offer sent to ${total.sent} customer${total.sent === 1 ? "" : "s"}.`);
    } catch (e) {
      setBulkError(e as ApiClientError);
    } finally {
      setBulk({ ...total, running: false });
      reload();
    }
  }

  return (
    <Modal open onClose={onClose} title={`Send "${coupon.title}" on WhatsApp`} size="xl">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            <Select label="Customers who visited" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Message"
            rows={9}
            value={text}
            onChange={(e) => setMessage(e.target.value)}
            hint={`{name} is filled in automatically for each customer${list[0] ? `, e.g. "Hi ${firstName(list[0].name)},"` : ""}.`}
            maxLength={3000}
          />
        </div>

        {data?.apiConfigured && (
          <div className="rounded-md border border-beige bg-cream/40 p-4">
            <p className="text-sm">
              <strong>WhatsApp Business API connected.</strong> Send the approved offer template automatically to the {optedInPending} opted-in customer
              {optedInPending === 1 ? "" : "s"} who haven&apos;t received it yet.
            </p>
            {bulkError && <Alert tone="error" className="mt-3">{bulkError.message}</Alert>}
            {bulk && (
              <p className="mt-2 text-xs text-stone">
                {bulk.running ? "Sending… " : "Done: "}
                {bulk.sent} sent{bulk.failed ? `, ${bulk.failed} failed` : ""}
              </p>
            )}
            <Button className="mt-3" loading={bulk?.running} disabled={!optedInPending} onClick={sendAll}>
              Send to {optedInPending} automatically
            </Button>
          </div>
        )}

        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="error">{error.message}</Alert>
        ) : !list.length ? (
          <EmptyState title="No customers to send to">
            <p className="mt-1 text-sm text-stone">No customers with a mobile number visited in this period. Try a longer period.</p>
          </EmptyState>
        ) : (
          <div>
            <p className="mb-2 text-xs text-stone">
              {`${list.length} customer${list.length === 1 ? "" : "s"} · ${sentCount} sent.`} Tap &quot;Open WhatsApp&quot;, then press Send in WhatsApp.
            </p>
            <ul className="max-h-[45vh] divide-y divide-beige overflow-y-auto rounded-md border border-beige bg-white text-sm">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-stone">
                      {formatPhone(r.phone)} · last visit {formatDate(r.lastVisitAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "sent" && <Badge className="bg-[#eef5ef] text-success">Sent{r.sentAt ? ` ${formatDate(r.sentAt)}` : ""}</Badge>}
                    {r.status === "failed" && <Badge className="bg-[#fbeceb] text-danger">Failed</Badge>}
                    <a
                      href={waHref(r.phone, text.replaceAll("{name}", firstName(r.name)))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => opened(r)}
                      className={buttonClass(r.status === "sent" ? "secondary" : "primary", "sm")}
                      title={r.error ?? undefined}
                    >
                      <MessageCircle size={14} aria-hidden /> {r.status === "sent" ? "Send again" : "Open WhatsApp"}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
