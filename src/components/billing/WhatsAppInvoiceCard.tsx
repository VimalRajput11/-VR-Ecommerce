"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Pencil } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Alert, Button, Card, Spinner, Textarea, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

interface Resp {
  phone: string;
  validPhone: boolean;
  url: string;
  message: string;
  link: string | null;
  apiConfigured: boolean;
  last: { status: string; error: string | null; at: string } | null;
}

/** Sends the invoice to the customer's WhatsApp: tap-to-send always, automatic when the Business API is set up. */
export default function WhatsAppInvoiceCard({ invoiceId }: { invoiceId: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Resp>(`/api/admin/invoices/${invoiceId}/whatsapp`);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ApiClientError | null>(null);
  const [copied, setCopied] = useState(false);
  // null = use the standard message; once edited, the edited text is what opens in WhatsApp.
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const text = edited ?? data?.message ?? "";
  const link = data?.link ? `${data.link.split("?")[0]}?text=${encodeURIComponent(text)}` : null;

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/api/admin/invoices/${invoiceId}/whatsapp`, { body: { action: "send" } });
      toast("Invoice sent on WhatsApp.");
      reload();
    } catch (e) {
      setSendError(e as ApiClientError);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!data) return;
    await navigator.clipboard.writeText(data.url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card title="Send on WhatsApp">
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : data && !data.validPhone ? (
        <p className="text-sm text-stone">This invoice has no valid 10-digit mobile number, so it can&apos;t be sent on WhatsApp.</p>
      ) : data ? (
        <div className="space-y-3">
          {sendError && <Alert tone="error">{sendError.message}</Alert>}
          {data.last && (
            <p className={`text-xs ${data.last.status === "failed" ? "text-danger" : "text-success"}`}>
              {data.last.status === "failed" ? `Last attempt failed: ${data.last.error ?? "unknown error"}` : `Sent ${formatDateTime(data.last.at)}`}
            </p>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                apiFetch(`/api/admin/invoices/${invoiceId}/whatsapp`, { body: { action: "opened", message: text } }).then(reload, () => undefined);
              }}
              className={`${buttonClass("primary")} w-full`}
            >
              <MessageCircle size={16} aria-hidden /> Open WhatsApp
            </a>
          )}
          {data.apiConfigured && (
            <Button variant="secondary" className="w-full" loading={sending} onClick={send}>
              {data.last?.status === "sent" ? "Send again automatically" : "Send automatically"}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full" onClick={copyLink}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Link copied" : "Copy invoice link"}
          </Button>
          <details className="text-xs text-stone" open={editing || undefined}>
            <summary className="cursor-pointer select-none">
              Preview message{edited !== null && edited !== data.message ? " (edited)" : ""}
            </summary>
            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea label="Message" rows={10} maxLength={3000} value={text} onChange={(e) => setEdited(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditing(false)}>
                    Done
                  </Button>
                  {edited !== null && edited !== data.message && (
                    <Button size="sm" variant="ghost" onClick={() => setEdited(null)}>
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative mt-2">
                <p className="whitespace-pre-wrap rounded-md border border-beige bg-cream/40 p-3 pr-16 text-charcoal">{text}</p>
                <Button size="sm" variant="secondary" className="absolute right-2 top-2 bg-white" onClick={() => setEditing(true)}>
                  <Pencil size={12} aria-hidden /> Edit
                </Button>
              </div>
            )}
          </details>
          {!data.apiConfigured && (
            <p className="text-xs text-stone">&quot;Open WhatsApp&quot; opens a chat with the message ready. Press Send in WhatsApp to deliver it.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
