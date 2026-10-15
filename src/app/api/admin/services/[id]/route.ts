import { api, json, readJson } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Service, type ServiceDoc } from "@/server/models";
import { parseServiceInput, serialiseAdminService } from "@/server/services/catalog";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("services.manage");
  const id = objectId((await ctx.params).id);
  const before = await Service.findById(id).lean();
  if (!before) throw notFound("Service not found.");
  const body = await readJson(req);
  const update = await parseServiceInput(body, true, id);
  if (body.archived === false) update.archived = false;
  const service = await Service.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean<ServiceDoc>();
  const changes = Object.keys(update).filter((k) => k !== "slug");
  const priceNote = "price" in update && update.price !== before.price ? ` (price ${formatINR(before.price)} → ${formatINR(update.price as number)})` : "";
  await audit(user, "service.update", "Service", String(id), `Updated ${service!.name}: ${changes.join(", ")}${priceNote}`);
  return json({ service: serialiseAdminService(service!) });
});

/** Services are archived rather than deleted so past bookings and invoices stay intact. */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("services.manage");
  const id = objectId((await ctx.params).id);
  const service = await Service.findByIdAndUpdate(id, { $set: { archived: true, active: false } }, { new: true }).lean();
  if (!service) throw notFound("Service not found.");
  await audit(user, "service.archive", "Service", String(id), `Archived ${service.name}`);
  return json({ ok: true });
});
