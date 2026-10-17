"use client";

import { useState } from "react";
import { Check, ChevronLeft, Copy, MessageCircle, Pencil } from "lucide-react";
import { useApi } from "@/lib/api";
import { Alert, Button, Input, Spinner, Textarea } from "@/components/ui";
import { buttonClass } from "@/components/ui/classes";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

interface Resp {
  code: string;
  balance: number;
  initialValue: number;
  expiresAt: string | null;
  name: string;
  phone: string;
  message: string;
}

/** Send a gift card on WhatsApp: same flow as sending an invoice (preview, edit, open WhatsApp). */
export default function GiftCardWhatsApp({ code, customerId, onBack }: { code: string; customerId?: string; onBack: () => void }) {
  const { data, error, loading } = useApi<Resp>(`/api/admin/gift-cards/whatsapp?code=${encodeURIComponent(code)}${customerId ? `&customerId=${customerId}` : ""}`);
  const [phone, setPhone] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const mobile = (phone ?? data?.phone ?? "").replace(/\D/g, "").slice(-10);
  const text = edited ?? data?.message ?? "";
  const link = mobile.length === 10 ? `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}` : null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-stone hover:text-charcoal">
        <ChevronLeft size={16} aria-hidden /> Back to gift cards
      </button>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : data ? (
        <>
          <div className="rounded-md bg-charcoal px-4 py-3 text-ivory">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Gift card</p>
            <p className="font-mono text-lg font-semibold">{data.code}</p>
            <p className="text-sm text-mist">
              {formatINR(data.balance)}
              {data.balance < data.initialValue ? ` left of ${formatINR(data.initialValue)}` : ""}
              {data.expiresAt ? ` · valid till ${formatDate(data.expiresAt)}` : " · no expiry"}
            </p>
          </div>

          <Input
            label={data.name ? `Send to ${data.name}` : "Customer's mobile"}
            type="tel"
            value={phone ?? data.phone}
            onChange={(e) => setPhone(e.target.value)}
            hint={mobile.length === 10 ? undefined : "Enter a 10-digit mobile number"}
          />

          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary")} w-full`}>
              <MessageCircle size={16} aria-hidden /> Open WhatsApp
            </a>
          ) : (
            <Button className="w-full" disabled>
              <MessageCircle size={16} aria-hidden /> Open WhatsApp
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={async () => {
              await navigator.clipboard?.writeText(data.code).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Code copied" : "Copy gift card code"}
          </Button>

          <details className="text-xs text-stone" open={editing || undefined}>
            <summary className="cursor-pointer select-none">Preview message{edited !== null && edited !== data.message ? " (edited)" : ""}</summary>
            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea label="Message" rows={12} maxLength={3000} value={text} onChange={(e) => setEdited(e.target.value)} />
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
          <p className="text-xs text-stone">&quot;Open WhatsApp&quot; opens a chat with the message ready. Press Send in WhatsApp to deliver it.</p>
        </>
      ) : null}
    </div>
  );
}
