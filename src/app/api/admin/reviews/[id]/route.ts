import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, objectId, oneOf } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Review } from "@/server/models";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("reviews.moderate");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = { moderatedBy: user.id, moderatedAt: new Date() };
  if ("status" in body) set.status = oneOf(body, "status", ["pending", "approved", "rejected"] as const);
  const reply = clearableStr(body, "reply", { max: 1000 });
  if (reply !== undefined) set.reply = reply;
  const review = await Review.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!review) throw notFound("Review not found.");
  await audit(user, "review.moderate", "Review", String(id), `Review by ${review.displayName} → ${review.status}`);
  return json({ ok: true });
});
