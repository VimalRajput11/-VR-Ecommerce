import { api, json, readJson } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { badRequest, conflict, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Coupon } from "@/server/models";
import { parseCoupon, serialiseCoupon } from "@/server/services/coupons";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("offers.manage");
  const id = objectId((await ctx.params).id);
  const existing = await Coupon.findById(id).lean();
  if (!existing) throw notFound("Coupon not found.");
  const body = await readJson(req);
  const update = parseCoupon({ type: existing.type, ...body }, true);
  if (update.code && update.code !== existing.code && (await Coupon.exists({ code: update.code }))) throw conflict("Code already in use.");
  const starts = (update.startsAt as Date) ?? existing.startsAt;
  const ends = (update.endsAt as Date) ?? existing.endsAt;
  if (ends <= starts) throw badRequest("End date must be after start date.", "endsAt");
  const coupon = await Coupon.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
  await audit(user, "coupon.update", "Coupon", String(id), `Updated coupon ${coupon!.code}: ${Object.keys(update).join(", ")}`);
  return json({ coupon: serialiseCoupon(coupon!) });
});
