import { api, json, readJson } from "@/server/lib/http";
import { int, objectId, oneOf, optStr, str } from "@/server/lib/validate";
import { forbidden, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Invoice, Payment, type InvoiceDoc } from "@/server/models";
import { invoiceBusiness, recordPayment, refundPayment, serialiseInvoice, voidInvoice } from "@/server/services/billing";
import { getSettings } from "@/server/services/settings";

type Ctx = { params: Promise<{ id: string }> };

async function respond(id: ReturnType<typeof objectId>) {
  const invoice = await Invoice.findById(id).lean<InvoiceDoc>();
  if (!invoice) throw notFound("Invoice not found.");
  const [payments, settings] = await Promise.all([Payment.find({ invoiceId: id }).sort({ createdAt: 1 }).lean(), getSettings()]);
  return json({
    invoice: serialiseInvoice(invoice, payments),
    business: invoiceBusiness(settings),
    paymentMethods: { cash: !!settings.payments?.cash, upi: !!settings.payments?.upi, card: !!settings.payments?.card, upiId: settings.payments?.upiId ?? "" },
  });
}

export const GET = api<Ctx>(async (_req, ctx) => {
  await requirePermission("billing.manage", "reports.view");
  return respond(objectId((await ctx.params).id));
});

export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("billing.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const action = oneOf(body, "action", ["payment", "refund", "void"] as const);
  if (action === "payment") {
    await recordPayment(
      id,
      {
        amount: int(body, "amount", { min: 1, max: 100_000_000, label: "Amount" }),
        method: oneOf(body, "method", ["cash", "upi", "card"] as const),
        reference: optStr(body, "reference", { max: 120 }),
        note: optStr(body, "note", { max: 300 }),
      },
      user,
    );
  } else if (action === "refund") {
    if (!user.permissions.includes("billing.refund")) throw forbidden("Only the owner can issue refunds.");
    await refundPayment(
      id,
      {
        amount: int(body, "amount", { min: 1, max: 100_000_000, label: "Amount" }),
        method: oneOf(body, "method", ["cash", "upi", "card", "online", "advance"] as const),
        reason: str(body, "reason", { max: 300, label: "Refund reason" }),
      },
      user,
    );
  } else {
    if (!user.permissions.includes("billing.refund")) throw forbidden("Only the owner can void invoices.");
    await voidInvoice(id, str(body, "reason", { max: 300, label: "Reason" }), user);
  }
  return respond(id);
});
