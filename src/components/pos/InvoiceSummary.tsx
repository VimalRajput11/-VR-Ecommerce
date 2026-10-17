"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useApi } from "@/lib/api";
import { formatDate } from "@/lib/time";
import SuggestInput from "./SuggestInput";
import { formatINR } from "@/lib/money";
import type { BillState, Quote } from "./bill";

/** Right panel: server-calculated totals, bill-level discounts, and the Discard / Save / Finalize actions. */
export default function InvoiceSummary({
  bill,
  setBill,
  quote,
  quoting,
  quoteError,
  canDiscount,
  loyaltyEnabled,
  today,
  dirty,
  draftNumber,
  saving,
  onDiscard,
  onSave,
  onFinalize,
}: {
  bill: BillState;
  setBill: (fn: (b: BillState) => BillState) => void;
  quote: Quote | null;
  quoting: boolean;
  quoteError: string | null;
  canDiscount: boolean;
  loyaltyEnabled: boolean;
  today: string;
  dirty: boolean;
  draftNumber: string | null;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onFinalize: () => void;
}) {
  const t = quote?.totals;
  const itemDiscounts = quote?.discounts.filter((d) => d.kind === "membership").reduce((s, d) => s + d.amount, 0) ?? 0;
  const billDiscounts = quote?.discounts.filter((d) => d.kind !== "membership") ?? [];
  const hasLines = !!quote?.lines.length;
  // Extra fields stay folded away unless something in them is set.
  const hasExtras = !!(bill.couponCode || Number(bill.manualDiscount.value) || Number(bill.loyaltyPoints) || bill.notes || bill.billDate !== today);
  const [showExtras, setShowExtras] = useState(false);
  const offers = useApi<{ offers: { code: string; title: string; discount: string; endsAt: string; firstVisitOnly: boolean }[] }>("/api/admin/billing/offers");
  const offerList = offers.data?.offers ?? [];
  const couponApplied = quote?.discounts.find((d) => d.kind === "coupon");
  const extrasOpen = showExtras || hasExtras;

  return (
    <aside>
      <section className="flex max-h-[calc(100vh-7rem)] flex-col rounded-lg border border-beige bg-white">
        <div className="flex items-center justify-between border-b border-beige px-4 py-2.5">
          <p className="font-serif text-lg">Invoice</p>
          <span className="flex items-center gap-2 text-xs text-stone">
            {quoting && <Loader2 size={13} className="animate-spin" aria-label="Updating" />}
            {draftNumber ? `Saved as ${draftNumber}${dirty ? " · unsaved changes" : ""}` : dirty ? "Not saved" : ""}
          </span>
        </div>

        {/* Items, totals and the discount fields scroll together; the heading and buttons stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {hasLines ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone">
                  <th className="px-4 py-2 font-semibold">Item</th>
                  <th className="px-2 py-2 text-right font-semibold">Price</th>
                  <th className="px-2 py-2 text-center font-semibold">Qty</th>
                  <th className="px-4 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote!.lines.map((l, i) => (
                  <tr key={i} className="border-t border-beige/70 align-top">
                    <td className="px-4 py-2">
                      {l.description}
                      {l.discount > 0 && <span className="block text-xs text-success">−{formatINR(l.discount)} membership</span>}
                    </td>
                    <td className="px-2 py-2 text-right">{formatINR(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-center">{l.qty}</td>
                    <td className="px-4 py-2 text-right">{formatINR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-4 text-center text-sm text-stone">No items yet.</p>
          )}

          {quoteError && (
            <Alert tone="error" className="mx-4 mb-3 text-xs">
              {quoteError}
            </Alert>
          )}

          <dl className="space-y-1 border-t border-beige px-4 py-2.5 text-sm">
            <Line label="Subtotal" value={t?.subtotal ?? 0} />
            <Line label="Item discounts (membership)" value={-itemDiscounts} hideZero />
            {billDiscounts.map((d, i) => (
              <Line key={i} label={d.kind === "coupon" ? `Coupon ${d.code ?? ""}` : d.kind === "loyalty" ? d.description : `Discount: ${d.description}`} value={-d.amount} />
            ))}
            <Line label="Total discount" value={-(t?.discountTotal ?? 0)} hideZero />
            {quote?.tax.rateBps ? (
              <>
                <Line label="Taxable amount" value={t?.taxableAmount ?? 0} />
                <Line label={`${quote.tax.name || "Tax"} ${quote.tax.rateBps / 100}%${quote.tax.inclusive ? " (included)" : ""}`} value={t?.taxAmount ?? 0} />
              </>
            ) : null}
            <div className="!my-2 flex items-center justify-between rounded-md bg-charcoal px-4 py-2 text-ivory">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Final amount</dt>
              <dd className="font-serif text-2xl">{formatINR(t?.total ?? 0)}</dd>
            </div>
            <Line label="Amount paid" value={0} />
            <div className="flex justify-between font-semibold">
              <dt>Remaining</dt>
              <dd>{formatINR(t?.total ?? 0)}</dd>
            </div>
          </dl>

          <div className="border-t border-beige px-4 py-2">
            <button
              type="button"
              aria-expanded={extrasOpen}
              onClick={() => setShowExtras((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone hover:text-charcoal"
            >
              Discount, coupon, date &amp; note
              <ChevronDown size={15} className={extrasOpen ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
            </button>
          </div>
          {extrasOpen && (
            <div className="space-y-2.5 px-4 pb-3">
              <SuggestInput
                label="Coupon / promotion code"
                visibleLabel
                uppercase
                showWhenEmpty
                placeholder={offerList.length ? "Pick a live offer or type a code" : "Type a code"}
                value={bill.couponCode}
                onChange={(v) => setBill((b) => ({ ...b, couponCode: v.replace(/\s+/g, "").slice(0, 30) }))}
                items={offerList
                  .filter((o) => !bill.couponCode || o.code.includes(bill.couponCode.toUpperCase()) || o.title.toLowerCase().includes(bill.couponCode.toLowerCase()))
                  .map((o) => ({ id: o.code, title: `${o.code} · ${o.title}`, subtitle: `${o.discount}${o.firstVisitOnly ? " · first visit only" : ""} · till ${formatDate(o.endsAt)}` }))}
                onPick={(code) => setBill((b) => ({ ...b, couponCode: code }))}
              />
              {couponApplied && (
                <p className="-mt-1 text-xs text-success">
                  ✓ {couponApplied.description}: −{formatINR(couponApplied.amount)}
                </p>
              )}
              {canDiscount && (
                <div className="grid grid-cols-[90px_1fr] gap-2">
                  <Select
                    label="Discount"
                    value={bill.manualDiscount.type}
                    onChange={(e) =>
                      setBill((b) => ({
                        ...b,
                        manualDiscount: {
                          ...b.manualDiscount,
                          type: e.target.value as "percent" | "flat",
                        },
                      }))
                    }
                  >
                    <option value="percent">%</option>
                    <option value="flat">₹</option>
                  </Select>
                  <Input
                    label="Value"
                    type="number"
                    min={0}
                    value={bill.manualDiscount.value}
                    onChange={(e) =>
                      setBill((b) => ({
                        ...b,
                        manualDiscount: {
                          ...b.manualDiscount,
                          value: e.target.value,
                        },
                      }))
                    }
                  />
                  {Number(bill.manualDiscount.value) > 0 && (
                    <Input
                      label="Reason"
                      required
                      wrapClassName="col-span-2"
                      value={bill.manualDiscount.reason}
                      onChange={(e) =>
                        setBill((b) => ({
                          ...b,
                          manualDiscount: {
                            ...b.manualDiscount,
                            reason: e.target.value,
                          },
                        }))
                      }
                    />
                  )}
                </div>
              )}
              {loyaltyEnabled && <Input label="Redeem loyalty points" type="number" min={0} value={bill.loyaltyPoints} onChange={(e) => setBill((b) => ({ ...b, loyaltyPoints: e.target.value }))} />}
              <div className="grid grid-cols-2 gap-2">
                <Input label="Bill date" type="date" max={today} value={bill.billDate} onChange={(e) => setBill((b) => ({ ...b, billDate: e.target.value }))} />
                <Input label="Invoice note" value={bill.notes} maxLength={500} onChange={(e) => setBill((b) => ({ ...b, notes: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-beige p-3">
          <Button variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="secondary" onClick={onSave} loading={saving} disabled={!hasLines && !bill.customer}>
            Save
          </Button>
          <Button onClick={onFinalize} disabled={!hasLines || !!quoteError || quoting || !bill.customer}>
            Finalize
          </Button>
          {!bill.customer && hasLines && <p className="col-span-3 text-center text-xs text-stone">Choose a customer to finalize.</p>}
        </div>
      </section>
    </aside>
  );
}

function Line({ label, value, hideZero }: { label: string; value: number; hideZero?: boolean }) {
  if (hideZero && !value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone">{label}</dt>
      <dd className={value < 0 ? "text-success" : ""}>{value < 0 ? `−${formatINR(-value)}` : formatINR(value)}</dd>
    </div>
  );
}
