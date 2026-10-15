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
  return { subtotal, discountTotal, taxAmount, total: Math.max(0, total) };
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
