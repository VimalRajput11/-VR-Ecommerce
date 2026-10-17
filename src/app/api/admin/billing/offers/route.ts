import { api, json } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { Coupon } from "@/server/models";
import { offerDiscountText } from "@/server/services/whatsapp";

/** Offers usable on a bill right now (for the coupon suggestions on the billing screen). */
export const GET = api(async () => {
  await requirePermission("billing.manage");
  const now = new Date();
  const coupons = await Coupon.find({ active: true, startsAt: { $lte: now }, endsAt: { $gte: now } })
    .sort({ endsAt: 1 })
    .limit(50)
    .lean();
  return json({
    offers: coupons
      .filter((c) => !c.maxRedemptions || (c.redemptions ?? 0) < c.maxRedemptions)
      .map((c) => ({
        code: c.code,
        title: c.title,
        discount: offerDiscountText(c),
        endsAt: c.endsAt,
        firstVisitOnly: !!c.firstVisitOnly,
      })),
  });
});
