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
  address: string;
  phone: string;
  email: string;
  gstin: string;
  footerNote: string;
}

/** Printable invoice / receipt used by both the customer portal and the dashboard. */
export default function InvoiceView({ invoice, business }: { invoice: InvoiceData; business: InvoiceBusiness }) {
  const rate = (invoice.tax.rateBps ?? 0) / 100;
  const methods = [...new Set(invoice.payments.filter((p) => p.kind === "payment").map((p) => PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method))];
  return (
    <article className="rounded-lg border border-beige bg-white p-6 text-sm print:border-0 print:p-0 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-beige pb-6">
        <div>
          <p className="font-serif text-2xl">{business.name}</p>
          {business.address && <p className="mt-1 max-w-xs text-stone">{business.address}</p>}
          {business.phone && <p className="text-stone">Phone: {formatPhone(business.phone)}</p>}
          {business.email && <p className="text-stone">{business.email}</p>}
          {business.gstin && <p className="text-stone">GSTIN: {business.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="eyebrow text-gold-deep">{invoice.status === "paid" ? "Receipt" : "Invoice"}</p>
          <p className="mt-1 font-mono text-lg font-semibold">{invoice.number}</p>
          <p className="text-stone">Date: {formatDate(invoice.issuedAt)}</p>
          <p className="mt-1 font-medium">{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</p>
        </div>
      </header>

      <div className="py-5">
        <p className="text-xs uppercase tracking-wider text-stone">Billed to</p>
        <p className="font-medium">{invoice.customer.name}</p>
        {invoice.customer.phone && <p className="text-stone">{formatPhone(invoice.customer.phone)}</p>}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-beige text-left text-xs uppercase tracking-wider text-stone">
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Rate</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i} className="border-b border-beige/60">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right">{l.qty}</td>
              <td className="py-2 text-right">{formatINR(l.unitPrice)}</td>
              <td className="py-2 text-right">{formatINR(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-5 max-w-xs space-y-1.5">
        <div className="flex justify-between">
          <dt className="text-stone">Subtotal</dt>
          <dd>{formatINR(invoice.subtotal)}</dd>
        </div>
        {invoice.discounts.map((d, i) => (
          <div key={i} className="flex justify-between">
            <dt className="text-stone">
              Discount{d.code ? ` (${d.code})` : d.description ? ` (${d.description})` : ""}
            </dt>
            <dd>−{formatINR(d.amount)}</dd>
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
        <div className="flex justify-between border-t border-beige pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatINR(invoice.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone">Amount paid</dt>
          <dd>{formatINR(invoice.amountPaid)}</dd>
        </div>
        {invoice.amountRefunded > 0 && (
          <div className="flex justify-between">
            <dt className="text-stone">Refunded</dt>
            <dd>−{formatINR(invoice.amountRefunded)}</dd>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Balance due</dt>
          <dd>{formatINR(invoice.balanceDue)}</dd>
        </div>
        {methods.length > 0 && (
          <div className="flex justify-between">
            <dt className="text-stone">Paid by</dt>
            <dd>{methods.join(", ")}</dd>
          </div>
        )}
      </dl>

      {invoice.payments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-stone">Payment history</p>
          <ul className="mt-2 space-y-1">
            {invoice.payments.map((p, i) => (
              <li key={i} className="flex justify-between gap-4 text-xs">
                <span>
                  {formatDateTime(p.at)} · {p.kind === "refund" ? "Refund" : "Payment"} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span>{p.kind === "refund" ? "−" : ""}{formatINR(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {invoice.voidReason && <p className="mt-6 text-danger">Void: {invoice.voidReason}</p>}
      {invoice.notes && <p className="mt-6 text-stone">Note: {invoice.notes}</p>}
      {business.footerNote && <p className="mt-8 border-t border-beige pt-4 text-center text-xs text-stone">{business.footerNote}</p>}
    </article>
  );
}
