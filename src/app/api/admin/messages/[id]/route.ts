import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, objectId, oneOf } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { ContactMessage } from "@/server/models";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  await requirePermission("messages.view");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {};
  if ("status" in body) set.status = oneOf(body, "status", ["new", "in_progress", "resolved"] as const);
  const notes = clearableStr(body, "notes", { max: 1000 });
  if (notes !== undefined) set.notes = notes;
  const msg = await ContactMessage.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!msg) throw notFound();
  return json({ ok: true });
});
