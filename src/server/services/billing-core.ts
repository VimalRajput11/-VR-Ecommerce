// Pure money calculations (integer paise). Shared by invoice creation and tests.

export interface TaxConfig {
  enabled?: boolean | null;
  rateBps?: number | null; // 1800 = 18%
  inclusive?: boolean | null;
}

export interface TotalsInput {
  lines: { amount: number; taxable?: boolean | null }[];
  discount: number;
  tax: TaxConfig;
}

export function computeTotals({ lines, discount, tax }: TotalsInput) {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountTotal = Math.max(0, Math.min(Math.round(discount), subtotal));
  const taxableSubtotal = lines.filter((l) => l.taxable !== false).reduce((s, l) => s + l.amount, 0);
  // Spread the discount proportionally over taxable and non-taxable lines.
  const taxableBase = subtotal === 0 ? 0 : taxableSubtotal - Math.round((discountTotal * taxableSubtotal) / subtotal);
  const rate = tax.enabled ? Math.max(0, tax.rateBps ?? 0) : 0;

  let taxAmount = 0;
  let total = subtotal - discountTotal;
  if (rate > 0 && taxableBase > 0) {
    if (tax.inclusive) {
      taxAmount = taxableBase - Math.round((taxableBase * 10_000) / (10_000 + rate));
    } else {
      taxAmount = Math.round((taxableBase * rate) / 10_000);
      total += taxAmount;
    }
  }
  return { subtotal, discountTotal, taxAmount, total: Math.max(0, total), taxableAmount: rate > 0 ? Math.max(0, taxableBase) : 0 };
}

export interface CouponRule {
  type: "percent" | "flat" | string;
  value: number;
  maxDiscount?: number | null;
  minSubtotal?: number | null;
  startsAt: Date;
  endsAt: Date;
  active?: boolean | null;
  maxRedemptions?: number | null;
  redemptions?: number | null;
  perCustomerLimit?: number | null;
  firstVisitOnly?: boolean | null;
}

/** Returns the discount in paise, or throws a message explaining why the coupon can't be used. */
export function couponDiscount(
  c: CouponRule,
  ctx: { eligibleSubtotal: number; subtotal: number; now: Date; customerRedemptions: number; isFirstVisit: boolean },
): number {
  if (!c.active) throw new Error("This coupon is not active.");
  if (ctx.now < c.startsAt) throw new Error("This coupon is not valid yet.");
  if (ctx.now > c.endsAt) throw new Error("This coupon has expired.");
  if (c.maxRedemptions && (c.redemptions ?? 0) >= c.maxRedemptions) throw new Error("This coupon has been fully redeemed.");
  if (ctx.customerRedemptions >= (c.perCustomerLimit ?? 1)) throw new Error("This coupon has already been used by this customer.");
  if (c.firstVisitOnly && !ctx.isFirstVisit) throw new Error("This coupon is only valid on a first visit.");
  if (ctx.subtotal < (c.minSubtotal ?? 0)) throw new Error("The bill does not meet this coupon's minimum amount.");
  if (ctx.eligibleSubtotal <= 0) throw new Error("This coupon does not apply to the selected services.");

  let amount = c.type === "percent" ? Math.round((ctx.eligibleSubtotal * Math.min(100, c.value)) / 100) : c.value;
  if (c.maxDiscount && c.maxDiscount > 0) amount = Math.min(amount, c.maxDiscount);
  return Math.max(0, Math.min(amount, ctx.eligibleSubtotal));
}

export function deriveInvoiceStatus(inv: { status?: string | null; total: number; amountPaid: number; amountRefunded: number; balanceDue: number }) {
  if (inv.status === "void") return "void";
  if (inv.amountRefunded > 0) return inv.amountRefunded >= inv.amountPaid ? "refunded" : "partially_refunded";
  if (inv.balanceDue <= 0) return "paid";
  if (inv.amountPaid > 0) return "partially_paid";
  return "unpaid";
}

export function loyaltyPointsFor(paidPaise: number, pointsPer100: number) {
  return Math.floor(paidPaise / 10_000) * Math.max(0, pointsPer100);
}

// ---------------------------------------------------------------- POS rules
// Shared by the billing screen (instant preview) and the server (authoritative check).

export interface Allocation {
  staffId: string;
  percent: number;
}

/**
 * Staff split for one service line. Each person once, whole percentages 1–100, never over 100%.
 * When `requireFull` is set (salon setting), a line that has any allocation must total exactly 100%.
 * Returns an error message, or null when valid.
 */
export function allocationError(allocations: Allocation[], requireFull: boolean): string | null {
  if (!allocations.length) return null;
  const ids = new Set<string>();
  let total = 0;
  for (const a of allocations) {
    if (!Number.isInteger(a.percent) || a.percent < 1 || a.percent > 100) return "Each staff share must be a whole percentage between 1 and 100.";
    if (ids.has(a.staffId)) return "The same staff member is listed twice on one service.";
    ids.add(a.staffId);
    total += a.percent;
  }
  if (total > 100) return "Staff shares on a service can't add up to more than 100%.";
  if (requireFull && total !== 100) return "Staff shares on each service must add up to 100%.";
  return null;
}

export interface MembershipBenefit {
  servicePercent: number;
  productPercent: number;
}

/** Membership discount per line (0 for lines the membership doesn't cover). */
export function membershipLineDiscounts(lines: { kind: string; amount: number }[], m: MembershipBenefit | null): number[] {
  return lines.map((l) => {
    if (!m) return 0;
    const pct = l.kind === "service" ? m.servicePercent : l.kind === "product" ? m.productPercent : 0;
    return Math.round((l.amount * Math.max(0, Math.min(100, pct))) / 100);
  });
}

export const CASH_LIKE = ["cash"] as const;

export interface TenderInput {
  method: string;
  amount: number;
}

/**
 * Splits the tendered payments against the amount due. Only cash may exceed what is owed (the
 * excess is change to hand back); any other method over the balance is an error.
 */
export function planPayments(due: number, tenders: TenderInput[]) {
  for (const t of tenders) {
    if (!Number.isInteger(t.amount) || t.amount <= 0) throw new Error("Each payment amount must be greater than zero.");
  }
  const nonCash = tenders.filter((t) => t.method !== "cash").reduce((s, t) => s + t.amount, 0);
  if (nonCash > due) throw new Error("Card, UPI, advance and gift card payments can't be more than the amount due.");
  let room = due - nonCash;
  const applied: TenderInput[] = [];
  let change = 0;
  for (const t of tenders) {
    if (t.method !== "cash") {
      applied.push({ ...t });
      continue;
    }
    const use = Math.min(t.amount, room);
    room -= use;
    change += t.amount - use;
    if (use > 0) applied.push({ method: t.method, amount: use });
  }
  const paid = applied.reduce((s, t) => s + t.amount, 0);
  return { applied, paid, change, remaining: due - paid };
}
