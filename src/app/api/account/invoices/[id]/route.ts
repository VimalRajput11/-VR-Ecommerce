import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requireUser } from "@/server/auth/session";
import { Invoice, Payment, type InvoiceDoc } from "@/server/models";
import { invoiceBusiness, serialiseInvoice } from "@/server/services/billing";
import { getSettings } from "@/server/services/settings";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const id = objectId((await ctx.params).id);
  const invoice = await Invoice.findOne({ _id: id, customerId: user.id, status: { $ne: "void" } }).lean<InvoiceDoc>();
  if (!invoice) throw notFound("Invoice not found.");
  const [payments, settings] = await Promise.all([Payment.find({ invoiceId: id }).sort({ createdAt: 1 }).lean(), getSettings()]);
  return json({ invoice: serialiseInvoice(invoice, payments), business: invoiceBusiness(settings) });
});
