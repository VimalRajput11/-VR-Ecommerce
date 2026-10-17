import { api, json } from "@/server/lib/http";
import { notFound } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { Invoice, Payment, type InvoiceDoc } from "@/server/models";
import { invoiceBusiness, serialiseInvoice } from "@/server/services/billing";
import { getSettings } from "@/server/services/settings";

type Ctx = { params: Promise<{ token: string }> };

/** Invoice opened from the private link sent on WhatsApp. Works without signing in. */
export const GET = api<Ctx>(async (req, ctx) => {
  rateLimit(`invoice-link:${clientIp(req)}`, 60, 60_000);
  const token = (await ctx.params).token;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw notFound("Invoice not found.");
  const invoice = await Invoice.findOne({ shareToken: token, status: { $ne: "void" } }).lean<InvoiceDoc>();
  if (!invoice) throw notFound("Invoice not found.");
  const [payments, settings] = await Promise.all([Payment.find({ invoiceId: invoice._id }).sort({ createdAt: 1 }).lean(), getSettings()]);
  // Internal ids are not needed by the customer, so they are blanked out.
  return json({ invoice: { ...serialiseInvoice(invoice, payments), customerId: "", appointmentId: null }, business: invoiceBusiness(settings) });
});
