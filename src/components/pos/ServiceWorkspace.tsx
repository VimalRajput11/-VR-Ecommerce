"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { cx } from "@/components/ui/classes";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/format";
import { allocationError } from "@/server/services/billing-core";
import { newKey, type Alloc, type BillState, type CatalogProduct, type CatalogService, type Quote, type StaffOption } from "./bill";

interface Props {
  bill: BillState;
  setBill: (fn: (b: BillState) => BillState) => void;
  services: CatalogService[];
  products: CatalogProduct[];
  staff: StaffOption[];
  quote: Quote | null;
  membership: { servicePercent: number; productPercent: number } | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const sameAllocs = (a: Alloc[], b: Alloc[]) => a.length === b.length && a.every((x, i) => x.staffId === b[i].staffId && x.percent === b[i].percent);

/** Centre of the billing screen: the selected service (who did it, qty) and the bill's editable lines. */
export default function ServiceWorkspace(p: Props) {
  const selected = p.services.find((s) => s.id === p.selectedId) ?? null;

  return (
    <div className="space-y-4">
      {selected && (
        <ServiceDetail
          key={selected.id}
          service={selected}
          staff={p.staff}
          membershipPercent={p.membership?.servicePercent ?? 0}
          onClose={() => p.setSelectedId(null)}
          onAdd={(qty, allocations) =>
            p.setBill((b) => {
              // Same service by the same people: bump the quantity instead of a duplicate line.
              const existing = b.services.find((l) => l.serviceId === selected.id && sameAllocs(l.allocations, allocations));
              if (existing) return { ...b, services: b.services.map((l) => (l === existing ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) };
              return { ...b, services: [...b.services, { key: newKey(), serviceId: selected.id, qty, allocations }] };
            })
          }
        />
      )}

      <InvoiceLines {...p} />
    </div>
  );
}

/** Staff split editor: who did the service and their share. */
export function AllocationEditor({ value, onChange, staff, compact }: { value: Alloc[]; onChange: (v: Alloc[]) => void; staff: StaffOption[]; compact?: boolean }) {
  const active = staff.filter((s) => s.active);
  const err = allocationError(value.filter((a) => a.staffId), false);
  const total = value.reduce((s, a) => s + (a.staffId ? a.percent : 0), 0);
  return (
    <div className="space-y-1.5">
      {value.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            aria-label="Staff member"
            value={a.staffId}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, staffId: e.target.value } : x)))}
            className={cx("min-w-0 flex-1 rounded-md border border-sand bg-white px-2 text-sm focus:border-gold focus:outline-none", compact ? "py-1" : "py-1.5")}
          >
            <option value="">Not specified</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center">
            <input
              aria-label="Share percent"
              type="number"
              min={1}
              max={100}
              value={a.percent}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, percent: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } : x)))}
              className={cx("w-14 rounded-md border border-sand bg-white px-1.5 text-right text-sm focus:border-gold focus:outline-none", compact ? "py-1" : "py-1.5")}
            />
            <span className="ml-0.5 text-xs text-stone">%</span>
          </div>
          {value.length > 1 && (
            <button type="button" aria-label="Remove staff" className="text-stone hover:text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 text-xs">
        {value.length < 4 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-gold-deep hover:underline"
            onClick={() => {
              const left = Math.max(1, 100 - total);
              onChange([...value, { staffId: "", percent: left }]);
            }}
          >
            <UserPlus size={12} aria-hidden /> Split with another
          </button>
        )}
        <span className={err || (total && total !== 100) ? "text-warning" : "text-stone"}>{err ?? (total ? `${total}% allocated` : "")}</span>
      </div>
    </div>
  );
}

/** Selected service: price breakdown, staff assignment and "Add to invoice". */
function ServiceDetail({
  service,
  staff,
  membershipPercent,
  onAdd,
  onClose,
}: {
  service: CatalogService;
  staff: StaffOption[];
  membershipPercent: number;
  onAdd: (qty: number, allocations: Alloc[]) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [allocs, setAllocs] = useState<Alloc[]>([{ staffId: "", percent: 100 }]);
  const lastAdd = useRef(0);
  const panel = useRef<HTMLElement>(null);
  // The service list can be long: bring the details into view when a service is picked.
  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  const membershipOff = Math.round((service.price * membershipPercent) / 100);
  const chosen = allocs.filter((a) => a.staffId);
  const err = allocationError(chosen, false);

  return (
    <section ref={panel} className="scroll-mt-4 rounded-lg border border-gold/40 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg leading-tight">{service.name}</p>
          <p className="text-xs text-stone">
            {formatDuration(service.durationMin)}
            {service.kind === "package" ? " · package" : ""}
            {service.taxable ? "" : " · tax exempt"}
          </p>
        </div>
        <button type="button" className="text-xs text-stone underline hover:text-charcoal" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <dl className="space-y-1 text-sm">
          <Row label={`Price${service.priceFrom ? " (starting from)" : ""}, before tax`} value={formatINR(service.price)} />
          <Row label={`Membership discount${membershipPercent ? ` (${membershipPercent}%)` : ""}`} value={membershipOff ? `−${formatINR(membershipOff)}` : "—"} />
          <Row label="Promotion / coupon" value="Applied on the bill" muted />
          <Row label="Manager discount" value="Applied on the bill" muted />
          <div className="flex justify-between border-t border-beige pt-1.5 font-semibold">
            <dt>Service price</dt>
            <dd>{formatINR((service.price - membershipOff) * qty)}</dd>
          </div>
        </dl>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone">Done by (optional)</p>
            <AllocationEditor value={allocs} onChange={setAllocs} staff={staff} />
          </div>
          <div className="flex items-end gap-2">
            <Input label="Qty" type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} wrapClassName="w-20" />
            <Button
              className="flex-1"
              disabled={!!err}
              onClick={() => {
                // Ignore an accidental double click.
                if (Date.now() - lastAdd.current < 600) return;
                lastAdd.current = Date.now();
                onAdd(qty, chosen);
                setQty(1);
              }}
            >
              Add to invoice
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone">{label}</dt>
      <dd className={muted ? "text-xs text-stone" : ""}>{value}</dd>
    </div>
  );
}

/** The bill's lines with quantity, discount, tax, total and staff, using the server's prices. */
function InvoiceLines({ bill, setBill, services, products, staff, quote }: Props) {
  // `sent` = included in the request (an unfinished custom item isn't); `unit` / `fallback` are shown until the server's price arrives.
  type Local = { key: string; group: "services" | "products" | "customLines" | "giftCards" | "advances" | "memberships"; label: string; qty?: number; unit: number; fallback: number; sent: boolean };
  const svcName = (id: string) => services.find((s) => s.id === id);
  const local: Local[] = [
    ...bill.services.map((l) => ({ key: l.key, group: "services" as const, label: svcName(l.serviceId)?.name ?? "Service", qty: l.qty, unit: svcName(l.serviceId)?.price ?? 0, fallback: (svcName(l.serviceId)?.price ?? 0) * l.qty, sent: true })),
    ...bill.products.map((l) => {
      const pr = products.find((x) => x.id === l.productId);
      return { key: l.key, group: "products" as const, label: pr?.name ?? "Product", qty: l.qty, unit: pr?.sellingPrice ?? 0, fallback: (pr?.sellingPrice ?? 0) * l.qty, sent: true };
    }),
    ...bill.customLines.map((l) => ({ key: l.key, group: "customLines" as const, label: l.description || "Custom item", unit: l.amount, fallback: l.amount, sent: !!l.description && l.amount > 0 })),
    ...bill.giftCards.map((l) => ({ key: l.key, group: "giftCards" as const, label: "Gift card", unit: l.amount, fallback: l.amount, sent: true })),
    ...bill.advances.map((l) => ({ key: l.key, group: "advances" as const, label: "Advance deposit", unit: l.amount, fallback: l.amount, sent: true })),
    ...bill.memberships.map((l) => ({ key: l.key, group: "memberships" as const, label: "Membership", unit: 0, fallback: 0, sent: true })),
  ];
  // Server lines come back in the same order, after any appointment items.
  const sentCount = local.filter((l) => l.sent).length;
  const offset = quote ? quote.lines.length - sentCount : 0;
  // Position of each sent line in the server's list (after any appointment items).
  const serverIndex: (number | null)[] = [];
  local.reduce((n, l) => (serverIndex.push(l.sent ? offset + n : null), l.sent ? n + 1 : n), 0);
  const quoteMatches = !!quote && offset >= 0;
  const apptLines = quote && offset > 0 ? quote.lines.slice(0, offset) : [];

  const remove = (l: Local) => setBill((b) => ({ ...b, [l.group]: (b[l.group] as { key: string }[]).filter((x) => x.key !== l.key) }) as BillState);
  const setQty = (l: Local, qty: number) =>
    setBill((b) => ({ ...b, [l.group]: (b[l.group] as { key: string; qty: number }[]).map((x) => (x.key === l.key ? { ...x, qty: Math.max(1, Math.min(l.group === "services" ? 20 : 100, qty)) } : x)) }) as BillState);

  if (!local.length && !apptLines.length) {
    return <section className="rounded-lg border border-dashed border-sand bg-white/60 px-4 py-8 text-center text-sm text-stone">Search for a service above and pick it to start the bill.</section>;
  }

  return (
    <section className="rounded-lg border border-beige bg-white">
      <div className="hidden grid-cols-[1fr_90px_96px_80px_90px_28px] gap-2 border-b border-beige bg-cream/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone md:grid">
        <span>Item</span>
        <span className="text-right">Price</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Discount</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      <ul className="divide-y divide-beige">
        {apptLines.map((l, i) => (
          <li key={`appt-${i}`} className="px-4 py-3 text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[1fr_90px_96px_80px_90px_28px]">
              <span>
                {l.description} <Badge>appointment</Badge>
                <span className="block text-xs text-stone">{l.allocations.map((a) => `${a.name} ${a.percent}%`).join(", ")}</span>
              </span>
              <span className="hidden text-right md:block">{formatINR(l.unitPrice)}</span>
              <span className="hidden text-center md:block">{l.qty}</span>
              <span className="hidden text-right md:block">{l.discount ? `−${formatINR(l.discount)}` : "—"}</span>
              <span className="text-right font-medium">{formatINR(l.amount - l.discount)}</span>
              <span className="hidden md:block" />
            </div>
          </li>
        ))}
        {local.map((l, i) => {
          const idx = serverIndex[i];
          const ql = quoteMatches && idx !== null ? quote!.lines[idx] : undefined;
          const svc = l.group === "services" ? bill.services.find((x) => x.key === l.key) : null;
          return (
            <li key={l.key} className="px-4 py-3 text-sm">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[1fr_90px_96px_80px_90px_28px]">
                <span className="min-w-0">
                  <span className="font-medium">{ql?.description ?? l.label}</span>
                  <span className="ml-1.5 text-xs text-stone">{ql ? (ql.taxable ? "" : "tax exempt") : ""}</span>
                </span>
                <span className="hidden text-right md:block">{formatINR(ql?.unitPrice ?? l.unit)}</span>
                <span className="flex items-center justify-center gap-1">
                  {l.qty !== undefined ? (
                    <>
                      <button type="button" aria-label="Decrease quantity" className="rounded border border-beige p-0.5 hover:bg-cream" onClick={() => setQty(l, (l.qty ?? 1) - 1)}>
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" className="rounded border border-beige p-0.5 hover:bg-cream" onClick={() => setQty(l, (l.qty ?? 1) + 1)}>
                        <Plus size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="text-stone">1</span>
                  )}
                </span>
                <span className="hidden text-right text-success md:block">{ql?.discount ? `−${formatINR(ql.discount)}` : "—"}</span>
                <span className="text-right font-medium">{formatINR(ql ? ql.amount - ql.discount : l.fallback)}</span>
                <button type="button" aria-label={`Remove ${l.label}`} className="justify-self-end text-stone hover:text-danger" onClick={() => remove(l)}>
                  <Trash2 size={15} />
                </button>
              </div>
              {svc && (
                <div className="mt-2 max-w-md">
                  <AllocationEditor
                    compact
                    value={svc.allocations.length ? svc.allocations : [{ staffId: "", percent: 100 }]}
                    staff={staff}
                    onChange={(v) => setBill((b) => ({ ...b, services: b.services.map((x) => (x.key === svc.key ? { ...x, allocations: v } : x)) }))}
                  />
                </div>
              )}
              {l.group === "customLines" && (
                <div className="mt-2 grid max-w-md grid-cols-[1fr_110px] gap-2">
                  <Input
                    label="Description"
                    value={bill.customLines.find((x) => x.key === l.key)?.description ?? ""}
                    onChange={(e) => setBill((b) => ({ ...b, customLines: b.customLines.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)) }))}
                  />
                  <Input
                    label="Amount (₹)"
                    type="number"
                    min={0}
                    value={(bill.customLines.find((x) => x.key === l.key)?.amount ?? 0) / 100 || ""}
                    onChange={(e) => setBill((b) => ({ ...b, customLines: b.customLines.map((x) => (x.key === l.key ? { ...x, amount: Math.round(Number(e.target.value) * 100) || 0 } : x)) }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-beige px-4 py-2">
        <Button size="sm" variant="ghost" onClick={() => setBill((b) => ({ ...b, customLines: [...b.customLines, { key: newKey(), description: "", amount: 0 }] }))}>
          + Custom item
        </Button>
      </div>
    </section>
  );
}

