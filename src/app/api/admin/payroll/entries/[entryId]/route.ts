import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { PayEntry, User } from "@/server/models";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";

type Ctx = { params: Promise<{ entryId: string }> };

/** Delete a mistaken pay record. */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("payroll.manage");
  const id = objectId((await ctx.params).entryId);
  const entry = await PayEntry.findByIdAndDelete(id).lean();
  if (!entry) throw notFound("Record not found.");
  const staff = await User.findById(entry.userId).select("name").lean();
  await audit(user, "payroll.entry_delete", "PayEntry", String(id), `Deleted ${entry.type} ${formatINR(entry.amount)} for ${staff?.name ?? "staff"} (${entry.month})`);
  return json({ ok: true });
});
