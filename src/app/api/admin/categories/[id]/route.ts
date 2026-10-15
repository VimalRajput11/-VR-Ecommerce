import { api, json, readJson } from "@/server/lib/http";
import { bool, clearableStr, objectId, optInt, optStr } from "@/server/lib/validate";
import { conflict, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Service, ServiceCategory } from "@/server/models";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("services.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {};
  const name = optStr(body, "name", { min: 1, max: 80 });
  if (name) set.name = name;
  const description = clearableStr(body, "description", { max: 400 });
  if (description !== undefined) set.description = description;
  const order = optInt(body, "order", { min: 0, max: 1000 });
  if (order !== undefined) set.order = order;
  const active = bool(body, "active");
  if (active !== undefined) set.active = active;
  const category = await ServiceCategory.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!category) throw notFound("Category not found.");
  await audit(user, "category.update", "ServiceCategory", String(id), `Updated category ${category.name}`);
  return json({ ok: true });
});

export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("services.manage");
  const id = objectId((await ctx.params).id);
  if (await Service.exists({ categoryId: id, archived: { $ne: true } }))
    throw conflict("Move or archive the services in this category first, or deactivate the category instead.");
  const category = await ServiceCategory.findByIdAndDelete(id).lean();
  if (!category) throw notFound("Category not found.");
  await audit(user, "category.delete", "ServiceCategory", String(id), `Deleted category ${category.name}`);
  return json({ ok: true });
});
