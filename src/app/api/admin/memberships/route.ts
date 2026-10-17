import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { MembershipPlan, type MembershipPlanDoc } from "@/server/models";
import { parsePlan, serialisePlan } from "@/server/services/memberships";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";

/** Membership plans: active ones for anyone billing; the owner (offers.manage) also sees inactive ones. */
export const GET = api(async () => {
  const user = await requirePermission("billing.manage", "offers.manage");
  const filter = user.permissions.includes("offers.manage") ? {} : { active: true };
  const plans = await MembershipPlan.find(filter).sort({ active: -1, price: 1 }).lean<MembershipPlanDoc[]>();
  return json({ plans: plans.map(serialisePlan) });
});

export const POST = api(async (req) => {
  const user = await requirePermission("offers.manage");
  const plan = await MembershipPlan.create(parsePlan(await readJson(req)));
  await audit(user, "membership.plan_create", "MembershipPlan", String(plan._id), `Created membership ${plan.name} (${formatINR(plan.price)})`);
  return json({ plan: serialisePlan(plan.toObject() as MembershipPlanDoc) }, 201);
});
