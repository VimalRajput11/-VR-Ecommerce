import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { Coupon } from "@/server/models";
import { parseCoupon, serialiseCoupon } from "@/server/services/coupons";
import { audit } from "@/server/services/audit";
import { conflict } from "@/server/lib/errors";

export const GET = api(async () => {
  await requirePermission("offers.manage", "billing.manage");
  const coupons = await Coupon.find().sort({ active: -1, endsAt: -1 }).limit(200).lean();
  return json({ coupons: coupons.map(serialiseCoupon) });
});

export const POST = api(async (req) => {
  const user = await requirePermission("offers.manage");
  const body = await readJson(req);
  const data = parseCoupon(body, false);
  if (await Coupon.exists({ code: data.code })) throw conflict("A coupon with this code already exists.");
  const coupon = await Coupon.create(data);
  await audit(user, "coupon.create", "Coupon", String(coupon._id), `Created coupon ${coupon.code}`);
  return json({ coupon: serialiseCoupon(coupon.toObject()) }, 201);
});
