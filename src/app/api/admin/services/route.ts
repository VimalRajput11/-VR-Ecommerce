import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { Service, ServiceCategory, type ServiceDoc } from "@/server/models";
import { parseServiceInput, serialiseAdminService } from "@/server/services/catalog";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";

export const GET = api(async (req) => {
  // Front desk needs the list to book and bill; only the owner can change it.
  await requirePermission("services.manage", "appointments.manage", "billing.manage");
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const [services, categories] = await Promise.all([
    Service.find(includeArchived ? {} : { archived: { $ne: true } }).sort({ order: 1, name: 1 }).lean<ServiceDoc[]>(),
    ServiceCategory.find().sort({ order: 1, name: 1 }).lean(),
  ]);
  return json({
    services: services.map(serialiseAdminService),
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, description: c.description ?? "", order: c.order, active: c.active, image: c.image ?? "" })),
  });
});

export const POST = api(async (req) => {
  const user = await requirePermission("services.manage");
  const body = await readJson(req);
  const input = await parseServiceInput(body, false);
  const service = await Service.create(input);
  await audit(user, "service.create", "Service", String(service._id), `Created ${service.name} at ${formatINR(service.price)}`);
  return json({ service: serialiseAdminService(service.toObject() as ServiceDoc) }, 201);
});
