"use client";

import { useState } from "react";
import { MessageCircle, TimerOff } from "lucide-react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import WhatsAppOfferModal from "@/components/dashboard/WhatsAppOfferModal";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Table, Td, Textarea, Th } from "@/components/ui";
import { istLocalToIso } from "@/components/dashboard/StaffForms";
import { formatINR, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { dateKeyIST, formatDate } from "@/lib/time";

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  kind: string;
  type: "percent" | "flat";
  value: number;
  maxDiscount: number;
  minSubtotal: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: number;
  perCustomerLimit: number;
  redemptions: number;
  firstVisitOnly: boolean;
  showOnWebsite: boolean;
  active: boolean;
}

const KINDS: Record<string, string> = { general: "General", seasonal: "Seasonal", festival: "Festival", first_visit: "First visit", referral: "Referral" };

export default function OffersPage() {
  return (
    <RequirePermission any={["offers.manage"]}>
      <Offers />
    </RequirePermission>
  );
}

function Offers() {
  const { data, error, loading, reload } = useApi<{ coupons: Coupon[] }>("/api/admin/coupons");
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [sharing, setSharing] = useState<Coupon | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toast = useToast();
  const confirm = useConfirm();

  // Ends a live offer immediately: the code stops working at billing from now on.
  async function expire(c: Coupon) {
    const ok = await confirm({
      title: `Expire ${c.code} now?`,
      danger: true,
      confirmLabel: "Expire now",
      message: <p>Customers won&apos;t be able to use this offer any more, and it disappears from the website. Past uses still count in reports.</p>,
    });
    if (!ok) return;
    try {
      const endsAt = new Date();
      await apiFetch(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: { endsAt: endsAt.toISOString() } });
      toast(`${c.code} has expired.`);
      setNow(endsAt.getTime() + 1000);
      reload();
    } catch (e) {
      toast((e as ApiClientError).message);
    }
  }
  return (
    <div>
      <PageHeader
        title="Offers & coupons"
        description="Seasonal, festival, first-visit and referral discounts. Limits and dates are enforced at billing."
        actions={<Button onClick={() => setEditing("new")}>New offer</Button>}
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.coupons.length ? (
        <EmptyState title="No offers yet" action={<Button onClick={() => setEditing("new")}>Create your first offer</Button>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Offer</Th>
              <Th>Discount</Th>
              <Th>Valid</Th>
              <Th>Used</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.coupons.map((c) => {
              const live = c.active && new Date(c.startsAt).getTime() <= now && new Date(c.endsAt).getTime() >= now;
              const status = !c.active ? "Off" : live ? "Live" : new Date(c.startsAt).getTime() > now ? "Scheduled" : "Expired";
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-cream/50" onClick={() => setEditing(c)}>
                  <Td className="font-mono font-semibold">{c.code}</Td>
                  <Td>
                    {c.title}
                    <span className="block text-xs text-stone">{KINDS[c.kind]}{c.showOnWebsite ? " · on website" : ""}</span>
                  </Td>
                  <Td>{c.type === "percent" ? `${c.value}%` : formatINR(c.value)}</Td>
                  <Td className="text-xs">
                    {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                  </Td>
                  <Td>
                    {c.redemptions}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </Td>
                  <Td>
                    <Badge className={status === "Live" ? "bg-[#eef5ef] text-success" : status === "Scheduled" ? "bg-[#f6efe4] text-gold-deep" : status === "Expired" ? "bg-[#fbeceb] text-danger" : undefined}>
                      {status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      {live && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            expire(c);
                          }}
                        >
                          <TimerOff size={14} aria-hidden /> Expire now
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharing(c);
                        }}
                      >
                        <MessageCircle size={14} aria-hidden /> WhatsApp
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {editing && <CouponModal coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {sharing && <WhatsAppOfferModal coupon={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

const toLocal = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
};

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const today = dateKeyIST();
  const [f, setF] = useState({
    code: coupon?.code ?? "",
    title: coupon?.title ?? "",
    description: coupon?.description ?? "",
    kind: coupon?.kind ?? "general",
    type: coupon?.type ?? "percent",
    value: coupon ? String(coupon.type === "flat" ? paiseToRupees(coupon.value) : coupon.value) : "",
    maxDiscount: coupon?.maxDiscount ? String(paiseToRupees(coupon.maxDiscount)) : "",
    minSubtotal: coupon?.minSubtotal ? String(paiseToRupees(coupon.minSubtotal)) : "",
    startsAt: coupon ? toLocal(coupon.startsAt) : `${today}T00:00`,
    endsAt: coupon ? toLocal(coupon.endsAt) : `${today}T23:59`,
    maxRedemptions: String(coupon?.maxRedemptions ?? 0),
    perCustomerLimit: String(coupon?.perCustomerLimit ?? 1),
    firstVisitOnly: coupon?.firstVisitOnly ?? false,
    showOnWebsite: coupon?.showOnWebsite ?? false,
    active: coupon?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      ...f,
      value: f.type === "flat" ? rupeesToPaise(Number(f.value)) : Math.round(Number(f.value)),
      maxDiscount: f.maxDiscount ? rupeesToPaise(Number(f.maxDiscount)) : 0,
      minSubtotal: f.minSubtotal ? rupeesToPaise(Number(f.minSubtotal)) : 0,
      startsAt: istLocalToIso(f.startsAt),
      endsAt: istLocalToIso(f.endsAt),
      maxRedemptions: Number(f.maxRedemptions) || 0,
      perCustomerLimit: Math.max(1, Number(f.perCustomerLimit) || 1),
    };
    try {
      if (coupon) await apiFetch(`/api/admin/coupons/${coupon.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/coupons", { body });
      toast("Offer saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={coupon ? `Edit ${coupon.code}` : "New offer"} size="lg" footer={<Button onClick={save} loading={busy}>Save</Button>}>
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Shown in capitals via CSS and saved in capitals by the server; converting while typing breaks phone keyboards. */}
        <Input
          label="Code"
          required
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.replace(/\s+/g, "") })}
          className="uppercase"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          hint="Letters, numbers and symbols, no spaces (e.g. DIWALI@25)"
        />
        <Input label="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Diwali Glow Offer" />
        <Textarea label="Description" rows={2} wrapClassName="sm:col-span-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Select label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "percent" | "flat" })}>
            <option value="percent">%</option>
            <option value="flat">₹</option>
          </Select>
          <Input label="Value" type="number" min={1} required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        </div>
        {f.type === "percent" && <Input label="Max discount (₹)" type="number" min={0} value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} hint="Blank = no cap" />}
        <Input label="Minimum bill (₹)" type="number" min={0} value={f.minSubtotal} onChange={(e) => setF({ ...f, minSubtotal: e.target.value })} />
        <Input label="Starts (IST)" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        <Input label="Ends (IST)" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
        <Input label="Total redemption limit" type="number" min={0} value={f.maxRedemptions} onChange={(e) => setF({ ...f, maxRedemptions: e.target.value })} hint="0 = unlimited" />
        <Input label="Uses per customer" type="number" min={1} value={f.perCustomerLimit} onChange={(e) => setF({ ...f, perCustomerLimit: e.target.value })} />
        <div className="space-y-2 sm:col-span-2">
          <Checkbox label="First visit only" checked={f.firstVisitOnly || f.kind === "first_visit"} disabled={f.kind === "first_visit"} onChange={(e) => setF({ ...f, firstVisitOnly: e.target.checked })} />
          <Checkbox label="Show on website (Offers page)" checked={f.showOnWebsite} onChange={(e) => setF({ ...f, showOnWebsite: e.target.checked })} />
          <Checkbox label="Active" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        </div>
      </div>
    </Modal>
  );
}
