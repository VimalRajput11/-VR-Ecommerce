import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { ApiError, conflict, notFound } from "@/server/lib/errors";
import { requireUser } from "@/server/auth/session";
import { Invoice } from "@/server/models";
import { getSettings, onlinePaymentsConfigured } from "@/server/services/settings";
import { createOrder } from "@/server/services/razorpay";

type Ctx = { params: Promise<{ id: string }> };

/** Starts an online payment for the outstanding balance. The browser never sets the amount. */
export const POST = api<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const settings = await getSettings();
  if (!settings.payments?.online || !onlinePaymentsConfigured())
    throw new ApiError(503, "Online payment is not available yet. Please pay at the salon.", "payments_unavailable");
  const id = objectId((await ctx.params).id);
  const invoice = await Invoice.findOne({ _id: id, customerId: user.id });
  if (!invoice) throw notFound("Invoice not found.");
  if (!["unpaid", "partially_paid"].includes(invoice.status) || invoice.balanceDue <= 0) throw conflict("Nothing is due on this invoice.");

  const order = await createOrder(invoice.balanceDue, invoice.number, { invoiceId: String(invoice._id) });
  invoice.gatewayOrderId = order.id;
  await invoice.save();
  return json({
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    name: settings.name,
    description: `Invoice ${invoice.number}`,
    prefill: { name: user.name, email: user.email ?? "", contact: user.phone ?? "" },
  });
});
