"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Printer, Receipt, Trash2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api";
import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { buttonClass } from "@/components/ui/classes";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { planPayments } from "@/server/services/billing-core";
import type { BillState, Quote } from "./bill";
import { toWire } from "./bill";

type Method = "cash" | "upi" | "card" | "advance" | "giftcard";
interface TenderRow {
  method: Method;
  amount: string; // rupees as typed
  reference: string;
  giftCardCode: string;
  giftBalance?: number | null;
}

const LABELS: Record<Method, string> = { cash: "Cash", upi: "UPI", card: "Debit / credit card", advance: "Advance balance", giftcard: "Gift card" };

interface Result {
  invoiceId: string;
  number: string;
  change: number;
  failures: string[];
  duplicate: boolean;
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9]/g, "");

/** Collect payment (split across methods) and finalize the bill. Amounts are re-checked on the server. */
export default function PaymentModal({
  bill,
  quote,
  draftId,
  advanceBalance,
  onClose,
  onDone,
}: {
  bill: BillState;
  quote: Quote;
  draftId: string | null;
  advanceBalance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const total = quote.totals.total;
  const enabled = (["cash", "upi", "card"] as const).filter((m) => quote.payments[m]);
  const methods: Method[] = [...enabled, ...(advanceBalance > 0 ? (["advance"] as const) : []), "giftcard"];
  const [rows, setRows] = useState<TenderRow[]>(() => [{ method: enabled[0] ?? "cash", amount: total ? String(paiseToRupees(total)) : "", reference: "", giftCardCode: "" }]);
  // One key per payment window: a retry after a network error can't create a second invoice.
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const tenders = rows.filter((r) => Number(r.amount) > 0).map((r) => ({ method: r.method, amount: rupeesToPaise(Number(r.amount)) }));
  let plan: ReturnType<typeof planPayments> | null = null;
  let planError: string | null = null;
  try {
    plan = planPayments(total, tenders);
  } catch (e) {
    planError = (e as Error).message;
  }
  const advanceUsed = tenders.filter((t) => t.method === "advance").reduce((s, t) => s + t.amount, 0);
  if (!planError && advanceUsed > advanceBalance) planError = `Advance balance is only ${formatINR(advanceBalance)}.`;
  const giftOver = rows.find((r) => r.method === "giftcard" && r.giftBalance != null && rupeesToPaise(Number(r.amount) || 0) > r.giftBalance);
  if (!planError && giftOver) planError = `Gift card ${giftOver.giftCardCode} has only ${formatINR(giftOver.giftBalance!)}.`;
  if (!planError && plan && plan.remaining > 0 && !quote.payments.allowPartial) planError = "Partial payments are turned off. Collect the full amount.";
  const remainingNow = plan?.remaining ?? total;

  const update = (i: number, patch: Partial<TenderRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function checkGiftCard(i: number) {
    const code = rows[i].giftCardCode.trim();
    if (!code) return;
    try {
      const res = await apiFetch<{ card: { balance: number; usable: boolean; status: string } }>(`/api/admin/gift-cards?code=${encodeURIComponent(code)}`);
      update(i, { giftBalance: res.card.usable ? res.card.balance : 0 });
      if (!res.card.usable) setError(new ApiClientError(`Gift card is ${res.card.status.toLowerCase()}.`, 400));
    } catch (e) {
      update(i, { giftBalance: null });
      setError(e as ApiClientError);
    }
  }

  async function finalize() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<Result>("/api/admin/billing/finalize", {
        body: {
          bill: toWire(bill),
          draftId: draftId ?? undefined,
          idempotencyKey: key,
          payments: rows
            .filter((r) => Number(r.amount) > 0)
            .map((r) => ({
              method: r.method,
              amount: rupeesToPaise(Number(r.amount)),
              reference: r.reference || undefined,
              giftCardCode: r.method === "giftcard" ? r.giftCardCode.trim() : undefined,
            })),
        },
      });
      setResult(res);
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Modal open onClose={onDone} title="Bill finalized">
        <div className="space-y-4 text-sm">
          <p className="flex items-center gap-2 text-success">
            <CheckCircle2 size={20} aria-hidden /> Invoice <strong>{result.number}</strong> {result.duplicate ? "was already saved." : "saved."}
          </p>
          {result.change > 0 && (
            <div className="rounded-md bg-charcoal px-4 py-3 text-ivory">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Change to return</p>
              <p className="font-serif text-2xl">{formatINR(result.change)}</p>
            </div>
          )}
          {result.failures.length > 0 && (
            <Alert tone="warning">
              Some payments were not recorded and are still due on the invoice:
              <ul className="mt-1 list-disc pl-5">
                {result.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`/dashboard/billing/${result.invoiceId}?print=1`} className={buttonClass("primary")}>
              <Printer size={16} aria-hidden /> Print / save PDF
            </Link>
            <Link href={`/dashboard/billing/${result.invoiceId}?print=thermal`} className={buttonClass("secondary")}>
              <Receipt size={16} aria-hidden /> Thermal receipt
            </Link>
            <Link href={`/dashboard/billing/${result.invoiceId}`} className={buttonClass("secondary")}>
              Invoice, payments &amp; WhatsApp
            </Link>
            <Button variant="ghost" onClick={onDone}>
              Start a new bill
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="Collect payment"
      size="lg"
      footer={
        <Button onClick={finalize} loading={busy} disabled={!!planError || busy}>
          {remainingNow > 0 && tenders.length ? `Finalize with ${formatINR(remainingNow)} due` : tenders.length ? "Finalize & record payment" : "Finalize unpaid"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Invoice total" value={total} strong />
          <Figure label="Entered" value={tenders.reduce((s, t) => s + t.amount, 0)} />
          <Figure label="Remaining" value={remainingNow} tone={remainingNow > 0 ? "warn" : "ok"} />
          <Figure label="Change" value={plan?.change ?? 0} />
        </div>

        {error && <Alert tone="error">{error.message}</Alert>}
        {planError && <Alert tone="warning">{planError}</Alert>}

        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="grid gap-2 rounded-md border border-beige p-3 sm:grid-cols-[170px_120px_1fr_auto] sm:items-end">
              <Select label="Method" value={r.method} onChange={(e) => update(i, { method: e.target.value as Method, giftBalance: undefined })}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {LABELS[m]}
                  </option>
                ))}
              </Select>
              <Input label="Amount (₹)" type="number" min={0} step="0.01" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} />
              {r.method === "giftcard" ? (
                <div className="flex items-end gap-2">
                  <Input
                    label="Gift card code"
                    value={r.giftCardCode}
                    className="uppercase"
                    autoCapitalize="characters"
                    autoComplete="off"
                    onChange={(e) => update(i, { giftCardCode: e.target.value.trim(), giftBalance: undefined })}
                    hint={r.giftBalance != null ? `Balance ${formatINR(r.giftBalance)}` : undefined}
                    wrapClassName="flex-1"
                  />
                  <Button size="sm" variant="secondary" className="mb-0.5" onClick={() => checkGiftCard(i)}>
                    Check
                  </Button>
                </div>
              ) : r.method === "advance" ? (
                <p className="pb-2 text-xs text-stone">Available: {formatINR(advanceBalance)}</p>
              ) : r.method === "cash" ? (
                <p className="pb-2 text-xs text-stone">Change is worked out automatically.</p>
              ) : (
                <Input
                  label={r.method === "upi" ? "UTR / reference" : "Last 4 digits / reference"}
                  value={r.reference}
                  maxLength={120}
                  onChange={(e) => update(i, { reference: e.target.value })}
                  hint={r.method === "upi" && quote.payments.upiId ? `Salon UPI: ${quote.payments.upiId}` : undefined}
                />
              )}
              <button type="button" aria-label="Remove payment" className="justify-self-end pb-2 text-stone hover:text-danger disabled:opacity-30" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        {rows.length < 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows((rs) => [...rs, { method: enabled.find((m) => !rs.some((r) => r.method === m)) ?? "cash", amount: remainingNow > 0 ? String(paiseToRupees(remainingNow)) : "", reference: "", giftCardCode: "" }])}
          >
            <Plus size={14} aria-hidden /> Split payment
          </Button>
        )}
        <p className="text-xs text-stone">
          Choosing UPI or card does not confirm the money arrived: check it on your UPI app / card machine before finalizing.
          {quote.payments.allowPartial ? " Anything not collected stays on the invoice as balance due." : ""}
        </p>
      </div>
    </Modal>
  );
}

function Figure({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "warn" | "ok" }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${strong ? "border-charcoal bg-charcoal text-ivory" : "border-beige bg-ivory"}`}>
      <p className={`text-[0.68rem] font-semibold uppercase tracking-wider ${strong ? "text-gold" : "text-stone"}`}>{label}</p>
      <p className={`font-semibold ${tone === "warn" && value > 0 ? "text-danger" : tone === "ok" ? "text-success" : ""}`}>{formatINR(value)}</p>
    </div>
  );
}
