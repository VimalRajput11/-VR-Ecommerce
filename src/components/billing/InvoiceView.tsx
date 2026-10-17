"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { PAYMENT_METHOD_LABELS, INVOICE_STATUS_LABELS, type PaymentMethod } from "@/lib/constants";
import { formatPhone } from "@/lib/format";

export interface InvoiceData {
  id: string;
  number: string;
  customer: { name?: string | null; phone?: string | null; email?: string | null };
  lines: { kind: string; description: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discounts: { kind: string; code?: string | null; description?: string | null; amount: number }[];
  discountTotal: number;
  tax: { name?: string | null; rateBps?: number | null; inclusive?: boolean | null; amount?: number | null };
  total: number;
  amountPaid: number;
  amountRefunded: number;
  balanceDue: number;
  status: string;
  notes?: string | null;
  issuedAt: string;
  voidReason?: string | null;
  payments: { kind: string; method: string; amount: number; reference?: string | null; note?: string | null; at: string }[];
}

export interface InvoiceBusiness {
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  footerNote: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "border-success/40 bg-[#eef5ef] text-success",
  void: "border-danger/40 bg-[#fbeceb] text-danger",
  refunded: "border-danger/40 bg-[#fbeceb] text-danger",
};

const noopSubscribe = () => () => {};

/**
 * Printable invoice / receipt used by the customer portal, the shared WhatsApp link and the dashboard.
 * For printing, a copy is portalled to <body> and globals.css prints only that copy, so the page
 * around it (sidebar, header, footer) never adds extra pages.
 */
export default function InvoiceView({ invoice, business }: { invoice: InvoiceData; business: InvoiceBusiness }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Browsers name the saved PDF after the page title, so use the invoice instead of "Dashboard".
  useEffect(() => {
    const kind = invoice.status === "paid" ? "Receipt" : "Invoice";
    const printTitle = [`${kind} ${invoice.number}`, invoice.customer.name, business.name].filter(Boolean).join(" - ");
    let previous = document.title;
    const before = () => {
      previous = document.title;
      document.title = printTitle;
    };
    const after = () => {
      document.title = previous;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [invoice.status, invoice.number, invoice.customer.name, business.name]);

  return (
    <>
      <InvoiceSheet invoice={invoice} business={business} />
      {mounted &&
        createPortal(
          <div className="print-only">
            <InvoiceSheet invoice={invoice} business={business} />
          </div>,
          document.body,
        )}
    </>
  );
}

function InvoiceSheet({ invoice, business }: { invoice: InvoiceData; business: InvoiceBusiness }) {
  const rate = (invoice.tax.rateBps ?? 0) / 100;
  const methods = [...new Set(invoice.payments.filter((p) => p.kind === "payment").map((p) => PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method))];
  const isReceipt = invoice.status === "paid";
  const statusLabel = INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status;

  return (
    <article className="invoice-sheet overflow-hidden rounded-lg border border-beige bg-white text-sm text-charcoal shadow-[0_1px_2px_rgba(27,26,24,0.04)]">
      {/* Brand band */}
      <header className="relative bg-charcoal px-6 py-6 text-ivory md:px-10 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="" width={76} height={76} priority className="h-[76px] w-[76px] shrink-0" />
            <div>
              <p className="font-serif text-2xl leading-tight text-gold md:text-3xl">{business.name}</p>
              {business.tagline && <p className="mt-0.5 text-xs italic text-mist">{business.tagline}</p>}
              {business.address && <p className="mt-1.5 max-w-xs text-xs text-ivory/80">{business.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-gold">{isReceipt ? "Receipt" : "Invoice"}</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{invoice.number}</p>
            <p className="text-xs text-mist">{formatDate(invoice.issuedAt)}</p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-gold-deep via-gold to-gold-deep" />
      </header>

      <div className="px-6 py-6 md:px-10 md:py-8">
        {/* Parties */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-ivory p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold-deep">Billed to</p>
            <p className="mt-1.5 text-base font-medium">{invoice.customer.name}</p>
            {invoice.customer.phone && <p className="text-stone">{formatPhone(invoice.customer.phone)}</p>}
            {invoice.customer.email && <p className="break-all text-stone">{invoice.customer.email}</p>}
          </div>
          <div className="rounded-md bg-ivory p-4 sm:text-right">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold-deep">From</p>
            {business.address && <p className="mt-1.5">{business.address}</p>}
            {business.phone && <p className="text-stone">{formatPhone(business.phone)}</p>}
            {business.email && <p className="break-all text-stone">{business.email}</p>}
            {business.gstin && <p className="text-stone">GSTIN: {business.gstin}</p>}
          </div>
        </div>

        {/* Items */}
        <table className="mt-6 w-full">
          <thead>
            <tr className="bg-cream text-left text-[0.68rem] uppercase tracking-[0.15em] text-stone">
              <th className="rounded-l-md px-3 py-2.5 font-semibold">Service / item</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
              <th className="rounded-r-md px-3 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-beige/70">
                <td className="px-3 py-3 font-medium">{l.description}</td>
                <td className="px-3 py-3 text-right text-stone">{l.qty}</td>
                <td className="px-3 py-3 text-right text-stone">{formatINR(l.unitPrice)}</td>
                <td className="px-3 py-3 text-right">{formatINR(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + status */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3">
            <span className={`inline-block rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${STATUS_STYLES[invoice.status] ?? "border-gold/50 bg-ivory text-gold-deep"}`}>
              {statusLabel}
            </span>
            {methods.length > 0 && <p className="text-xs text-stone">Paid by {methods.join(", ")}</p>}
          </div>
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-stone">Subtotal</dt>
              <dd>{formatINR(invoice.subtotal)}</dd>
            </div>
            {invoice.discounts.map((d, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-stone">
                  Discount{d.code ? ` (${d.code})` : d.description ? ` (${d.description})` : ""}
                </dt>
                <dd className="text-success">−{formatINR(d.amount)}</dd>
              </div>
            ))}
            {(invoice.tax.amount ?? 0) > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone">
                  {invoice.tax.name} {rate}% {invoice.tax.inclusive ? "(included)" : ""}
                </dt>
                <dd>{invoice.tax.inclusive ? formatINR(invoice.tax.amount ?? 0) : `+${formatINR(invoice.tax.amount ?? 0)}`}</dd>
              </div>
            )}
            <div className="!mt-3 flex items-center justify-between rounded-md bg-charcoal px-4 py-3 text-ivory">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Total</dt>
              <dd className="font-serif text-2xl">{formatINR(invoice.total)}</dd>
            </div>
            <div className="flex justify-between pt-1">
              <dt className="text-stone">Amount paid</dt>
              <dd>{formatINR(invoice.amountPaid)}</dd>
            </div>
            {invoice.amountRefunded > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone">Refunded</dt>
                <dd>−{formatINR(invoice.amountRefunded)}</dd>
              </div>
            )}
            <div className={`flex justify-between font-semibold ${invoice.balanceDue > 0 ? "text-danger" : ""}`}>
              <dt>Balance due</dt>
              <dd>{formatINR(invoice.balanceDue)}</dd>
            </div>
          </dl>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-6">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold-deep">Payment history</p>
            <ul className="mt-2 space-y-1">
              {invoice.payments.map((p, i) => (
                <li key={i} className="flex justify-between gap-4 text-xs text-stone">
                  <span>
                    {formatDateTime(p.at)} · {p.kind === "refund" ? "Refund" : "Payment"} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span>
                    {p.kind === "refund" ? "−" : ""}
                    {formatINR(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {invoice.voidReason && <p className="mt-6 text-danger">Void: {invoice.voidReason}</p>}
        {invoice.notes && <p className="mt-6 rounded-md border border-beige px-4 py-3 text-stone">Note: {invoice.notes}</p>}

        {/* Thank-you footer */}
        <footer className="mt-8 border-t border-beige pt-6 text-center">
          <p className="font-serif text-lg text-gold-deep">{business.footerNote || `Thank you for visiting ${business.name}!`}</p>
          <p className="mt-1 text-xs text-stone">We look forward to seeing you again.</p>
          {business.phone && <p className="mt-1 text-xs text-stone">Book your next visit: {formatPhone(business.phone)}</p>}
        </footer>
      </div>
    </article>
  );
}
