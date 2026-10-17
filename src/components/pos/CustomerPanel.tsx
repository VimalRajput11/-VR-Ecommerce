"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, History, UserRound, Wallet, X } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api";
import { Alert, Badge, Button, Input, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/format";
import { formatDate, formatDateKey } from "@/lib/time";
import type { BillCustomer, CustomerSummary } from "./bill";

/** Left panel: who the bill is for, with membership, advance balance and visit history. */
export default function CustomerPanel({
  customer,
  summary,
  loading,
  locked,
  onChange,
  onAddCustomer,
}: {
  customer: BillCustomer | null;
  summary: CustomerSummary | null;
  loading: boolean;
  locked?: boolean; // appointment bills keep the appointment's customer
  onChange: (c: BillCustomer | null) => void;
  onAddCustomer: () => void;
}) {
  if (!customer) {
    return (
      <section className="rounded-lg border border-beige bg-white p-4">
        <div className="flex flex-col items-center py-4 text-center">
          <UserRound size={28} className="text-sand" aria-hidden />
          <p className="mt-2 font-medium">No customer selected</p>
          <p className="mt-1 text-xs text-stone">Search by mobile number or name above, or enter a walk-in below.</p>
        </div>
        <WalkIn onSave={onChange} />
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onAddCustomer}>
          + Add new customer
        </Button>
      </section>
    );
  }

  const s = summary;
  return (
    <section className="space-y-3 rounded-lg border border-beige bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg leading-tight">{s?.name ?? customer.name}</p>
          <p className="text-stone">{formatPhone(s?.phone ?? customer.phone)}</p>
          {(s?.email || customer.email) && <p className="truncate text-xs text-stone">{s?.email || customer.email}</p>}
        </div>
        {!locked && (
          <button type="button" aria-label="Change customer" className="rounded p-1 text-stone hover:bg-cream hover:text-charcoal" onClick={() => onChange(null)}>
            <X size={16} />
          </button>
        )}
      </div>

      {loading && !s ? (
        <Spinner />
      ) : s ? (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-stone">Birthday</dt>
            <dd>{s.birthday ? formatDateKey(s.birthday).slice(0, 5) : "—"}</dd>
            {s.gender && (
              <>
                <dt className="text-stone">Gender</dt>
                <dd className="capitalize">{s.gender}</dd>
              </>
            )}
            <dt className="text-stone">Visits</dt>
            <dd>{s.visits}</dd>
            <dt className="text-stone">Last visit</dt>
            <dd>{s.lastVisitAt ? formatDate(s.lastVisitAt) : "—"}</dd>
            {s.loyaltyPoints > 0 && (
              <>
                <dt className="text-stone">Loyalty points</dt>
                <dd>{s.loyaltyPoints}</dd>
              </>
            )}
          </dl>

          <div className={`rounded-md border p-2.5 ${s.membership ? "border-gold/40 bg-[#f6efe4]" : "border-beige bg-ivory"}`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-deep">
              <Crown size={13} aria-hidden /> Membership
            </p>
            {s.membership ? (
              <>
                <p className="mt-1 font-medium">{s.membership.name}</p>
                <p className="text-xs text-stone">
                  {[s.membership.servicePercent ? `${s.membership.servicePercent}% off services` : "", s.membership.productPercent ? `${s.membership.productPercent}% off products` : ""]
                    .filter(Boolean)
                    .join(" · ") || "No discount"}
                </p>
                <p className="text-xs text-stone">Valid till {formatDateKey(s.membership.endsOn)}</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-stone">Not a member</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-beige bg-ivory p-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone">
              <Wallet size={13} aria-hidden /> Advance
            </span>
            <span className="font-semibold">{formatINR(s.advanceBalance)}</span>
          </div>
          {s.balanceDue > 0 && (
            <Alert tone="warning" className="text-xs">
              Unpaid balance from earlier bills: <strong>{formatINR(s.balanceDue)}</strong>
            </Alert>
          )}
          {(s.preferences || s.internalNotes) && (
            <div className="text-xs">
              <p className="font-semibold uppercase tracking-wider text-stone">Notes</p>
              {s.preferences && <p className="mt-0.5 whitespace-pre-wrap">{s.preferences}</p>}
              {s.internalNotes && <p className="mt-0.5 whitespace-pre-wrap text-stone">Staff: {s.internalNotes}</p>}
            </div>
          )}
          {s.isGuest && <Badge>Guest profile</Badge>}
          <Link href={`/dashboard/customers?id=${s.id}`} className="inline-flex items-center gap-1.5 text-xs text-gold-deep underline">
            <History size={13} aria-hidden /> Client history
          </Link>
        </>
      ) : (
        <p className="text-xs text-stone">Walk-in customer. A customer record is created when the bill is finalized.</p>
      )}
    </section>
  );
}

/** Quick name + mobile entry for a walk-in when search isn't needed. */
function WalkIn({ onSave }: { onSave: (c: BillCustomer) => void }) {
  const [f, setF] = useState({ name: "", phone: "" });
  const valid = f.name.trim().length > 0 && f.phone.replace(/\D/g, "").length >= 10;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ name: f.name.trim(), phone: f.phone.trim() });
      }}
    >
      <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
      <Input label="Mobile" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="off" />
      <Button type="submit" size="sm" className="w-full" disabled={!valid}>
        Use walk-in
      </Button>
    </form>
  );
}

/** Create a customer without leaving the billing screen. */
export function AddCustomerModal({ initialPhone, onClose, onCreated }: { initialPhone?: string; onClose: () => void; onCreated: (c: BillCustomer) => void }) {
  const [f, setF] = useState({ name: "", phone: initialPhone ?? "", email: "", birthday: "", gender: "", preferences: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ customer: { id: string; name: string; phone: string; email: string } }>("/api/admin/customers", {
        body: { ...f, email: f.email || undefined, birthday: f.birthday || undefined, gender: f.gender || undefined, preferences: f.preferences || undefined },
      });
      onCreated({ id: res.customer.id, name: res.customer.name, phone: res.customer.phone, email: res.customer.email });
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add customer"
      footer={
        <Button onClick={save} loading={busy} disabled={!f.name.trim() || !f.phone.trim()}>
          Save customer
        </Button>
      }
    >
      {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Mobile" required type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Birthday" type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} />
        <Select label="Gender (optional)" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          <option value="">Not specified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </Select>
        <Textarea label="Notes / preferences" rows={2} wrapClassName="sm:col-span-2" value={f.preferences} onChange={(e) => setF({ ...f, preferences: e.target.value })} />
      </div>
    </Modal>
  );
}
