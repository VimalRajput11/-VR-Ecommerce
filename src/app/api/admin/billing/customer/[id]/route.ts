import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { posCustomerSummary } from "@/server/services/pos";

/** Customer panel on the billing screen: contact, membership, advance balance, visits, amount due. */
export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("customers.view");
  return json({ customer: await posCustomerSummary(objectId((await ctx.params).id), user) });
});

type Ctx = { params: Promise<{ id: string }> };
