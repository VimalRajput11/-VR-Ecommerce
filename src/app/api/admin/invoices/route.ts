import { api, json, readJson } from "@/server/lib/http";
import { dateKey, escapeRegex, int, isObjectId, objectId, optEmail, optInt, optStr, pagination, phone, str } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Invoice, type InvoiceDoc } from "@/server/models";
import { addDaysToKey, istToUtc } from "@/lib/time";
import { createInvoice, serialiseInvoice, type InvoiceInput } from "@/server/services/billing";

export const GET = api(async (req) => {
  await requirePermission("billing.manage", "reports.view");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};
  const status = p.get("status");
  if (status === "outstanding") filter.status = { $in: ["unpaid", "partially_paid"] };
  else if (status) filter.status = status;
  if (p.get("from") || p.get("to")) {
    filter.issuedAt = {
      ...(p.get("from") ? { $gte: istToUtc(dateKey(p.get("from"), "from"), 0) } : {}),
      ...(p.get("to") ? { $lt: istToUtc(addDaysToKey(dateKey(p.get("to"), "to"), 1), 0) } : {}),
    };
  }
  const customer = p.get("customer");
  if (customer && isObjectId(customer)) filter.customerId = customer;
  const q = p.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
    filter.$or = [{ number: rx }, { "customer.name": rx }, { "customer.phone": rx }];
  }
  const { page, limit, skip } = pagination(p, 25);
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean<InvoiceDoc[]>(),
    Invoice.countDocuments(filter),
  ]);
  return json({ items: items.map((i) => serialiseInvoice(i)), total, page, limit });
});

function parseList<T>(raw: unknown, field: string, map: (v: Record<string, unknown>) => T): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw badRequest(`${field} must be a list.`, field);
  if (raw.length > 50) throw badRequest(`Too many ${field}.`, field);
  return raw.map((v) => map((v ?? {}) as Record<string, unknown>));
}

export const POST = api(async (req) => {
  const user = await requirePermission("billing.manage");
  const body = await readJson(req);
  const input: InvoiceInput = {
    services: parseList(body.services, "services", (v) => ({ serviceId: objectId(v.serviceId, "services"), qty: int(v, "qty", { min: 1, max: 20 }) })),
    products: parseList(body.products, "products", (v) => ({ productId: objectId(v.productId, "products"), qty: int(v, "qty", { min: 1, max: 100 }) })),
    customLines: parseList(body.customLines, "customLines", (v) => ({
      description: str(v, "description", { max: 200, label: "Item description" }),
      amount: int(v, "amount", { min: 1, max: 100_000_000, label: "Item amount" }),
    })),
    couponCode: optStr(body, "couponCode", { max: 30 }),
    loyaltyPoints: optInt(body, "loyaltyPoints", { min: 0, max: 1_000_000 }),
    notes: optStr(body, "notes", { max: 500 }),
  };
  if (body.manualDiscount && typeof body.manualDiscount === "object") {
    const md = body.manualDiscount as Record<string, unknown>;
    const type = md.type === "percent" ? "percent" : "flat";
    const value = int(md, "value", { min: 0, max: type === "percent" ? 100 : 100_000_000, label: "Discount" });
    if (value > 0) input.manualDiscount = { type, value, reason: str(md, "reason", { max: 200, label: "Discount reason" }) };
  }
  if (body.appointmentId) {
    input.appointmentId = objectId(body.appointmentId, "appointmentId");
  } else {
    const c = (body.customer ?? {}) as Record<string, unknown>;
    input.customer = {
      userId: isObjectId(c.id) ? c.id : undefined,
      name: str(c, "name", { max: 100, label: "Customer name" }),
      phone: phone(c),
      email: optEmail(c),
    };
  }
  const invoice = await createInvoice(input, user);
  return json({ invoice: serialiseInvoice(invoice.toObject()) }, 201);
});
