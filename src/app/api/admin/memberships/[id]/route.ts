import { api, json, readJson } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { MembershipPlan, type MembershipPlanDoc } from "@/server/models";
import { audit } from "@/server/services/audit";
import { parsePlan, serialisePlan } from "@/server/services/memberships";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a plan. Customers who already bought it keep the terms they paid for. */
export const PUT = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("offers.manage");
  const id = objectId((await ctx.params).id);
  const plan = await MembershipPlan.findByIdAndUpdate(id, { $set: parsePlan(await readJson(req)) }, { new: true, runValidators: true }).lean<MembershipPlanDoc>();
  if (!plan) throw notFound("Membership plan not found.");
  await audit(user, "membership.plan_update", "MembershipPlan", String(id), `Updated membership ${plan.name}`);
  return json({ plan: serialisePlan(plan) });
});
