import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { forbidden, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { TimeOff } from "@/server/models";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("staff.manage", "availability.own");
  const id = objectId((await ctx.params).id);
  const item = await TimeOff.findById(id).lean();
  if (!item) throw notFound();
  if (!user.permissions.includes("staff.manage") && String(item.staffId) !== user.id) throw forbidden();
  await TimeOff.deleteOne({ _id: id });
  await audit(user, "timeoff.delete", "TimeOff", String(id), `Removed ${item.kind}`);
  return json({ ok: true });
});
