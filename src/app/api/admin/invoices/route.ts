import { api, json, readJson } from "@/server/lib/http";
import { dateKey, escapeRegex, isObjectId, pagination } from "@/server/lib/validate";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Invoice, type InvoiceDoc } from "@/server/models";
import { addDaysToKey, istToUtc } from "@/lib/time";
import { createInvoice, deleteAllInvoices, serialiseInvoice } from "@/server/services/billing";
import { parseBillInput } from "@/server/services/bill-input";

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

export const POST = api(async (req) => {
  const user = await requirePermission("billing.manage");
  const input = await parseBillInput(await readJson(req));
  const invoice = await createInvoice(input, user);
  return json({ invoice: serialiseInvoice(invoice.toObject()) }, 201);
});

/** Owner only: delete every invoice (e.g. test bills before going live). Body must be { confirm: "DELETE" }. */
export const DELETE = api(async (req) => {
  const user = await requirePermission("billing.refund");
  const body = await readJson(req);
  if (body.confirm !== "DELETE") throw badRequest('Type DELETE to confirm.', "confirm");
  return json(await deleteAllInvoices(user));
});
