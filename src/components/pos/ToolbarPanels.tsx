"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Trash2 } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { Alert, Badge, Button, EmptyState, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatDuration } from "@/lib/format";
import type { BillCustomer, CatalogService, CustomerSummary, Plan } from "./bill";
import GiftCardWhatsApp from "./GiftCardWhatsApp";

const amountOk = (v: string) => Number(v) >= 1;

/** Cards: sell a gift card on this bill, or check a card's balance. */
export function CardsPanel({ customer, canIssue, onClose, onSell }: { customer: BillCustomer | null; canIssue: boolean; onClose: () => void; onSell: (amountPaise: number) => void }) {
  const hasCustomer = !!customer;
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [card, setCard] = useState<{ code: string; balance: number; initialValue: number; expiresAt: string | null; status: string } | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const recent = useApi<{ cards: { code: string; initialValue: number; balance: number; expiresAt: string | null; active: boolean; soldAt: string; free: boolean; customer: string }[] }>(
    "/api/admin/gift-cards",
  );
  // Gift card being sent on WhatsApp (shown in place of the lists).
  const [sending, setSending] = useState<{ code: string; customerId?: string } | null>(null);

  async function check() {
    setError(null);
    setCard(null);
    try {
      const res = await apiFetch<{ card: NonNullable<typeof card> }>(`/api/admin/gift-cards?code=${encodeURIComponent(code.trim())}`);
      setCard(res.card);
    } catch (e) {
      setError(e as ApiClientError);
    }
  }

  return (
    <Modal open onClose={onClose} title={sending ? "Send gift card on WhatsApp" : "Gift cards"} size="lg">
      {sending ? (
        <GiftCardWhatsApp code={sending.code} customerId={sending.customerId} onBack={() => setSending(null)} />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="font-medium">Sell a gift card</p>
              <Input label="Card value (₹)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button
                disabled={!amountOk(amount)}
                onClick={() => {
                  onSell(rupeesToPaise(Number(amount)));
                  onClose();
                }}
              >
                Add gift card to bill
              </Button>
              <p className="text-xs text-stone">The card and its code are issued when the bill is paid in full. Anyone with the code can use it.</p>
              {!hasCustomer && <p className="text-xs text-warning">Choose the buyer on the bill (search their mobile or add them) before finalizing.</p>}
            </div>
            <div className="space-y-3">
              <p className="font-medium">Check a balance</p>
              {error && <Alert tone="error">{error.message}</Alert>}
              <div className="flex items-end gap-2">
                <Input label="Card code" value={code} className="uppercase" autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value.trim())} wrapClassName="flex-1" />
                <Button variant="secondary" className="mb-0.5" disabled={!code} onClick={check}>
                  Check
                </Button>
              </div>
              {card && (
                <div className="rounded-md border border-beige bg-ivory p-3 text-sm">
                  <p className="font-mono font-semibold">{card.code}</p>
                  <p>
                    Balance <strong>{formatINR(card.balance)}</strong> of {formatINR(card.initialValue)}
                  </p>
                  <p className="text-xs text-stone">
                    {card.status}
                    {card.expiresAt ? ` · valid till ${formatDate(card.expiresAt)}` : " · no expiry"}
                  </p>
                </div>
              )}
            </div>
          </div>
          {canIssue && <IssueGiftCard customer={customer} onIssued={recent.reload} onSend={(c, customerId) => setSending({ code: c, customerId })} />}
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Recent gift cards</p>
            {recent.loading && !recent.data ? (
              <Spinner />
            ) : recent.data?.cards.length ? (
              <ul className="max-h-48 divide-y divide-beige overflow-y-auto rounded-md border border-beige text-sm">
                {recent.data.cards.map((c) => (
                  <li key={c.code} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-mono">{c.code}</span> {c.free && <Badge className="bg-[#f6efe4] text-gold-deep">free</Badge>}
                      {c.customer && <span className="block text-xs text-stone">{c.customer}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-stone">
                        {formatINR(c.balance)} / {formatINR(c.initialValue)} · {formatDate(c.soldAt)}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => setSending({ code: c.code })}>
                        <MessageCircle size={13} aria-hidden /> WhatsApp
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">No gift cards sold yet.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

/** Advance: the customer's prepaid balance, add a deposit to this bill, or (owner) refund some back. */
export function AdvancePanel({
  customer,
  summary,
  canRefund,
  onClose,
  onDeposit,
  onChanged,
}: {
  customer: BillCustomer | null;
  summary: CustomerSummary | null;
  canRefund: boolean;
  onClose: () => void;
  onDeposit: (amountPaise: number) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [refund, setRefund] = useState({ amount: "", method: "cash", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function doRefund() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/billing/customer/${summary.id}/advance`, { body: { amount: rupeesToPaise(Number(refund.amount)), method: refund.method, note: refund.note } });
      toast("Advance refunded.");
      setRefund({ amount: "", method: "cash", note: "" });
      onChanged();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Customer advance" size="lg">
      {!customer ? (
        <EmptyState title="Select a customer first">
          <p className="mt-1 text-sm text-stone">Advance balances belong to a customer.</p>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {error && <Alert tone="error">{error.message}</Alert>}
          <div className="flex items-center justify-between rounded-md bg-charcoal px-4 py-3 text-ivory">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{customer.name}&apos;s advance</span>
            <span className="font-serif text-2xl">{formatINR(summary?.advanceBalance ?? 0)}</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <p className="font-medium">Take an advance</p>
              <Input label="Amount (₹)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button
                disabled={!amountOk(amount)}
                onClick={() => {
                  onDeposit(rupeesToPaise(Number(amount)));
                  onClose();
                }}
              >
                Add advance to bill
              </Button>
              <p className="text-xs text-stone">Credited to the customer when the bill is paid, with a receipt. Use it later as a payment method.</p>
            </div>
            {canRefund && summary && summary.advanceBalance > 0 && (
              <div className="space-y-3">
                <p className="font-medium">Refund advance (owner)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Amount (₹)" type="number" min={1} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
                  <Select label="Paid back by" value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </Select>
                </div>
                <Input label="Reason" required value={refund.note} onChange={(e) => setRefund({ ...refund, note: e.target.value })} />
                <Button variant="danger" loading={busy} disabled={!amountOk(refund.amount) || !refund.note.trim()} onClick={doRefund}>
                  Record refund
                </Button>
              </div>
            )}
          </div>
          {summary?.advanceHistory.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">History</p>
              <ul className="divide-y divide-beige rounded-md border border-beige text-sm">
                {summary.advanceHistory.map((h, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span>
                      <Badge>{h.type}</Badge>{" "}
                      <span className="text-xs text-stone">
                        {formatDateTime(h.at)}
                        {h.note ? ` · ${h.note}` : ""}
                      </span>
                    </span>
                    <span>
                      {h.balanceAfter > h.balanceBefore ? "+" : "−"}
                      {formatINR(h.amount)} <span className="text-xs text-stone">→ {formatINR(h.balanceAfter)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** Packages: the salon's package services, added to the bill like any service. */
export function PackagesPanel({ services, onClose, onPick }: { services: CatalogService[]; onClose: () => void; onPick: (id: string) => void }) {
  const packages = services.filter((s) => s.kind === "package" && s.active && !s.archived);
  return (
    <Modal open onClose={onClose} title="Packages">
      {packages.length ? (
        <ul className="divide-y divide-beige rounded-md border border-beige text-sm">
          {packages.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
              <span className="min-w-0">
                <span className="font-medium">{s.name}</span>
                <span className="block text-xs text-stone">
                  {s.priceFrom ? "from " : ""}
                  {formatINR(s.price)} · {formatDuration(s.durationMin)}
                </span>
              </span>
              <Button
                size="sm"
                onClick={() => {
                  onPick(s.id);
                  onClose();
                }}
              >
                Select
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No packages yet">
          <p className="mt-1 text-sm text-stone">
            Create a service with type &quot;Package&quot; in{" "}
            <Link href="/dashboard/services" className="underline">
              Services
            </Link>
            .
          </p>
        </EmptyState>
      )}
    </Modal>
  );
}

/** Memberships: the customer's membership, plans to sell, and (owner) plan setup. */
export function MembershipsPanel({
  summary,
  customer,
  canManage,
  onClose,
  onSell,
}: {
  summary: CustomerSummary | null;
  customer: BillCustomer | null;
  canManage: boolean;
  onClose: () => void;
  onSell: (plan: Plan) => void;
}) {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ plans: Plan[] }>("/api/admin/memberships");
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [f, setF] = useState({ name: "", price: "", durationDays: "365", servicePercent: "", productPercent: "", description: "", active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  function open(p: Plan | "new") {
    setEditing(p);
    setError(null);
    setF(
      p === "new"
        ? { name: "", price: "", durationDays: "365", servicePercent: "", productPercent: "", description: "", active: true }
        : {
            name: p.name,
            price: String(p.price / 100),
            durationDays: String(p.durationDays),
            servicePercent: String(p.servicePercent),
            productPercent: String(p.productPercent),
            description: p.description,
            active: p.active,
          },
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      name: f.name,
      price: rupeesToPaise(Number(f.price) || 0),
      durationDays: Math.round(Number(f.durationDays) || 0),
      servicePercent: Math.round(Number(f.servicePercent) || 0),
      productPercent: Math.round(Number(f.productPercent) || 0),
      description: f.description,
      active: f.active,
    };
    try {
      if (editing === "new") await apiFetch("/api/admin/memberships", { body });
      else if (editing) await apiFetch(`/api/admin/memberships/${editing.id}`, { method: "PUT", body });
      toast("Membership plan saved.");
      setEditing(null);
      reload();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Memberships" size="lg">
      <div className="space-y-5">
        <div className="rounded-md border border-beige bg-ivory p-3 text-sm">
          {!customer ? (
            <p className="text-stone">Select a customer to see their membership.</p>
          ) : summary?.membership ? (
            <p>
              <strong>{customer.name}</strong> is a <strong>{summary.membership.name}</strong> member until {formatDate(summary.membership.endsOn)}.
              {summary.membership.servicePercent ? ` ${summary.membership.servicePercent}% off services.` : ""}
              {summary.membership.productPercent ? ` ${summary.membership.productPercent}% off products.` : ""} The discount is applied to this bill automatically.
            </p>
          ) : (
            <p>
              <strong>{customer.name}</strong> is not a member.
            </p>
          )}
        </div>

        {loading && !data ? (
          <Spinner />
        ) : data?.plans.length ? (
          <ul className="divide-y divide-beige rounded-md border border-beige text-sm">
            {data.plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <span className="min-w-0">
                  <span className="font-medium">{p.name}</span> {!p.active && <Badge>inactive</Badge>}
                  <span className="block text-xs text-stone">
                    {formatINR(p.price)} · {p.durationDays} days
                    {p.servicePercent ? ` · ${p.servicePercent}% off services` : ""}
                    {p.productPercent ? ` · ${p.productPercent}% off products` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => open(p)}>
                      Edit
                    </Button>
                  )}
                  {p.active && (
                    <Button
                      size="sm"
                      disabled={!customer}
                      onClick={() => {
                        onSell(p);
                        onClose();
                      }}
                    >
                      {summary?.membership ? "Renew on bill" : "Add to bill"}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">No membership plans yet.{canManage ? " Create one below." : " Ask the owner to set them up."}</p>
        )}

        {canManage &&
          (editing ? (
            <div className="space-y-3 rounded-md border border-beige p-4">
              <p className="font-medium">{editing === "new" ? "New membership plan" : `Edit ${editing.name}`}</p>
              {error && <Alert tone="error">{error.message}</Alert>}
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} wrapClassName="sm:col-span-2" />
                <Input label="Price (₹)" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
                <Input label="Valid for (days)" type="number" min={1} value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })} />
                <Input label="% off services" type="number" min={0} max={100} value={f.servicePercent} onChange={(e) => setF({ ...f, servicePercent: e.target.value })} />
                <Input label="% off products" type="number" min={0} max={100} value={f.productPercent} onChange={(e) => setF({ ...f, productPercent: e.target.value })} />
                <Textarea label="Description" rows={2} wrapClassName="sm:col-span-3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Available to sell
              </label>
              <div className="flex gap-2">
                <Button onClick={save} loading={busy} disabled={!f.name.trim()}>
                  Save plan
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => open("new")}>
              + New membership plan
            </Button>
          ))}
      </div>
    </Modal>
  );
}

export interface OpenDraft {
  id: string;
  number: string;
  customer: { name?: string; phone?: string } | null;
  previewTotal: number;
  itemCount: number;
  updatedAt: string;
  version: number;
  payload: Record<string, unknown>;
}

/** Open invoices: saved bills to continue, and finalized bills that still have money due. */
export function OpenInvoicesPanel({
  data,
  loading,
  currentDraftId,
  onClose,
  onOpen,
  onDiscarded,
}: {
  data: { drafts: OpenDraft[]; unpaid: { id: string; number: string; customer?: { name?: string }; total: number; balanceDue: number; status: string; issuedAt: string }[] } | null;
  loading: boolean;
  currentDraftId: string | null;
  onClose: () => void;
  onOpen: (d: OpenDraft) => void;
  onDiscarded: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  async function discard(d: OpenDraft) {
    const ok = await confirm({
      title: `Discard ${d.number}?`,
      danger: true,
      confirmLabel: "Discard",
      message: <p>This saved bill{d.customer?.name ? ` for ${d.customer.name}` : ""} will be removed from Open invoices. Finalized invoices are not affected.</p>,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/admin/billing/drafts/${d.id}`, { method: "DELETE" });
      toast(`${d.number} discarded.`);
      onDiscarded();
    } catch (e) {
      toast((e as ApiClientError).message);
    }
  }
  return (
    <Modal open onClose={onClose} title="Open invoices" size="lg">
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Saved bills ({data?.drafts.length ?? 0})</p>
            {data?.drafts.length ? (
              <ul className="divide-y divide-beige rounded-md border border-beige text-sm">
                {data.drafts.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold">{d.number}</span> {d.id === currentDraftId && <Badge>open now</Badge>}
                      <span className="block text-xs text-stone">
                        {d.customer?.name || "No customer"} · {d.itemCount} item{d.itemCount === 1 ? "" : "s"} · {formatINR(d.previewTotal)} · {formatDateTime(d.updatedAt)}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => onOpen(d)}>
                        Continue
                      </Button>
                      <button type="button" aria-label={`Discard ${d.number}`} className="text-stone hover:text-danger" onClick={() => discard(d)}>
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">No saved bills. Use Save on a bill to keep it here.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Finalized with balance due ({data?.unpaid.length ?? 0})</p>
            {data?.unpaid.length ? (
              <ul className="divide-y divide-beige rounded-md border border-beige text-sm">
                {data.unpaid.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <span>
                      <span className="font-mono font-semibold">{i.number}</span>
                      <span className="block text-xs text-stone">
                        {i.customer?.name} · {formatDate(i.issuedAt)} · total {formatINR(i.total)}
                      </span>
                    </span>
                    <Link href={`/dashboard/billing/${i.id}`} className="text-sm font-medium text-danger underline">
                      Collect {formatINR(i.balanceDue)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">Nothing outstanding.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Owner: give a gift card without a sale (gift, reward, festival offer). */
function IssueGiftCard({ customer, onIssued, onSend }: { customer: BillCustomer | null; onIssued: () => void; onSend: (code: string, customerId?: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: "", expiresOn: "", note: "", forCustomer: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [issued, setIssued] = useState<{ code: string; balance: number; expiresAt: string | null } | null>(null);
  const forCustomer = f.forCustomer && !!customer?.id;

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ card: NonNullable<typeof issued> }>("/api/admin/gift-cards", {
        body: { amount: rupeesToPaise(Number(f.amount)), expiresOn: f.expiresOn || undefined, note: f.note, customerId: forCustomer ? customer!.id : undefined },
      });
      setIssued(res.card);
      setF({ amount: "", expiresOn: "", note: "", forCustomer: true });
      toast(`Gift card ${res.card.code} issued.`);
      onIssued();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-md border border-gold/40 bg-[#f6efe4]/40 p-4">
      <p className="font-medium">Issue a gift card (owner)</p>
      <p className="text-xs text-stone">For a gift, reward or festival offer. No payment is taken and it doesn&apos;t count as a sale.</p>
      {error && <Alert tone="error">{error.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Card value (₹)" type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input label="Valid till (optional)" type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} hint="Blank = no expiry" />
        <Input label="Reason" required value={f.note} maxLength={300} placeholder="e.g. Diwali gift" onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      {customer?.id && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.forCustomer} onChange={(e) => setF({ ...f, forCustomer: e.target.checked })} /> Record it as given to {customer.name}
        </label>
      )}
      <Button onClick={issue} loading={busy} disabled={!amountOk(f.amount) || !f.note.trim()}>
        Issue gift card
      </Button>
      {issued && (
        <div className="rounded-md border border-beige bg-white p-3 text-sm">
          <p className="text-xs text-stone">New gift card</p>
          <p className="font-mono text-lg font-semibold">{issued.code}</p>
          <p>
            {formatINR(issued.balance)}
            {issued.expiresAt ? ` · valid till ${formatDate(issued.expiresAt)}` : " · no expiry"}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              className="text-gold-deep underline"
              onClick={() =>
                navigator.clipboard?.writeText(issued.code).then(
                  () => toast("Code copied."),
                  () => undefined,
                )
              }
            >
              Copy code
            </button>
            <button type="button" className="text-gold-deep underline" onClick={() => onSend(issued.code, customer?.id)}>
              Send on WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
