// Client-side state of the bill being built on the billing screen, and its conversion to the
// request body the server understands (amounts in paise). The server recalculates every price.

export interface Alloc {
  staffId: string;
  percent: number;
}

export interface BillCustomer {
  id?: string;
  name: string;
  phone: string;
  email?: string;
}

export interface BillState {
  customer: BillCustomer | null;
  appointmentId?: string;
  services: { key: string; serviceId: string; qty: number; allocations: Alloc[] }[];
  products: { key: string; productId: string; qty: number }[];
  customLines: { key: string; description: string; amount: number }[];
  giftCards: { key: string; amount: number }[];
  advances: { key: string; amount: number }[];
  memberships: { key: string; planId: string }[];
  couponCode: string;
  manualDiscount: { type: "percent" | "flat"; value: string; reason: string };
  loyaltyPoints: string;
  notes: string;
  billDate: string;
}

export const emptyBill = (billDate: string): BillState => ({
  customer: null,
  services: [],
  products: [],
  customLines: [],
  giftCards: [],
  advances: [],
  memberships: [],
  couponCode: "",
  manualDiscount: { type: "percent", value: "", reason: "" },
  loyaltyPoints: "",
  notes: "",
  billDate,
});

let seq = 0;
export const newKey = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const itemCount = (b: BillState) =>
  b.services.length + b.products.length + b.customLines.length + b.giftCards.length + b.advances.length + b.memberships.length + (b.appointmentId ? 1 : 0);

/** Request body for quote / save / finalize. */
export function toWire(b: BillState) {
  const dv = Number(b.manualDiscount.value);
  return {
    customer: b.customer ? { id: b.customer.id, name: b.customer.name, phone: b.customer.phone, email: b.customer.email || undefined } : undefined,
    appointmentId: b.appointmentId || undefined,
    services: b.services.map((s) => ({ serviceId: s.serviceId, qty: s.qty, allocations: s.allocations.filter((a) => a.staffId) })),
    products: b.products.map((p) => ({ productId: p.productId, qty: p.qty })),
    customLines: b.customLines.filter((c) => c.description && c.amount > 0).map((c) => ({ description: c.description, amount: c.amount })),
    giftCards: b.giftCards.map((g) => ({ amount: g.amount })),
    advances: b.advances.map((a) => ({ amount: a.amount })),
    memberships: b.memberships.map((m) => ({ planId: m.planId })),
    couponCode: b.couponCode.trim() || undefined,
    manualDiscount:
      dv > 0 ? { type: b.manualDiscount.type, value: b.manualDiscount.type === "percent" ? Math.round(dv) : Math.round(dv * 100), reason: b.manualDiscount.reason } : undefined,
    loyaltyPoints: Number(b.loyaltyPoints) > 0 ? Math.round(Number(b.loyaltyPoints)) : undefined,
    notes: b.notes || undefined,
    billDate: b.billDate || undefined,
  };
}

type Wire = Partial<ReturnType<typeof toWire>> & Record<string, unknown>;

/** Rebuilds the editor state from a saved draft's payload. */
export function fromWire(p: Wire, today: string): BillState {
  const md = p.manualDiscount as { type?: string; value?: number; reason?: string } | undefined;
  return {
    customer: p.customer ? { id: p.customer.id, name: p.customer.name ?? "", phone: p.customer.phone ?? "", email: p.customer.email ?? "" } : null,
    appointmentId: (p.appointmentId as string) || undefined,
    services: (p.services ?? []).map((s) => ({ key: newKey(), serviceId: s.serviceId, qty: s.qty ?? 1, allocations: (s.allocations ?? []).map((a) => ({ staffId: a.staffId, percent: a.percent })) })),
    products: (p.products ?? []).map((x) => ({ key: newKey(), productId: x.productId, qty: x.qty ?? 1 })),
    customLines: (p.customLines ?? []).map((c) => ({ key: newKey(), description: c.description, amount: c.amount })),
    giftCards: (p.giftCards ?? []).map((g) => ({ key: newKey(), amount: g.amount })),
    advances: (p.advances ?? []).map((a) => ({ key: newKey(), amount: a.amount })),
    memberships: (p.memberships ?? []).map((m) => ({ key: newKey(), planId: m.planId })),
    couponCode: (p.couponCode as string) ?? "",
    manualDiscount: md?.value
      ? { type: md.type === "flat" ? "flat" : "percent", value: String(md.type === "flat" ? (md.value ?? 0) / 100 : md.value), reason: md.reason ?? "" }
      : { type: "percent", value: "", reason: "" },
    loyaltyPoints: p.loyaltyPoints ? String(p.loyaltyPoints) : "",
    notes: (p.notes as string) ?? "",
    billDate: (p.billDate as string) || today,
  };
}

// ---------------------------------------------------------------- shapes returned by the APIs

export interface QuoteLine {
  kind: string;
  refId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
  discount: number;
  taxable: boolean;
  allocations: { staffId: string; percent: number; name: string }[];
}

export interface Quote {
  customer: { name: string; phone?: string };
  lines: QuoteLine[];
  discounts: { kind: string; code: string | null; description: string; amount: number }[];
  totals: { subtotal: number; discountTotal: number; taxAmount: number; total: number; taxableAmount: number };
  tax: { name: string; rateBps: number; inclusive: boolean };
  membership: { name: string; endsOn: string; servicePercent: number; productPercent: number } | null;
  payments: { cash: boolean; upi: boolean; card: boolean; upiId: string; allowPartial: boolean };
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  gender: string;
  preferences: string;
  internalNotes?: string;
  isGuest: boolean;
  loyaltyPoints: number;
  advanceBalance: number;
  membership: { name: string; startsOn: string; endsOn: string; servicePercent: number; productPercent: number } | null;
  visits: number;
  lastVisitAt: string | null;
  balanceDue: number;
  advanceHistory: { type: string; amount: number; balanceBefore: number; balanceAfter: number; at: string; note: string }[];
}

export interface CatalogService {
  id: string;
  name: string;
  categoryId: string;
  kind: string;
  durationMin: number;
  price: number;
  priceFrom: boolean;
  taxable: boolean;
  description: string;
  active: boolean;
  archived: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  sellingPrice: number;
  quantity: number;
  unit: string;
}

export interface StaffOption {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  servicePercent: number;
  productPercent: number;
  description: string;
  active: boolean;
}
