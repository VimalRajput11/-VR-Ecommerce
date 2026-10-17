import { api, json, readJson } from "@/server/lib/http";
import { int, objectId, oneOf, str } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { refundAdvance } from "@/server/services/pos";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Owner only: give part of a customer's advance back in cash / UPI. Deposits are taken on a bill
 * (Advance → add to bill) so they always have a receipt; spending happens at payment.
 */
export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("billing.refund");
  const body = await readJson(req);
  const balance = await refundAdvance(
    objectId((await ctx.params).id),
    int(body, "amount", { min: 1, max: 100_000_000, label: "Amount" }),
    oneOf(body, "method", ["cash", "upi", "card"] as const),
    str(body, "note", { max: 300, label: "Reason" }),
    user,
  );
  return json({ advanceBalance: balance });
});
