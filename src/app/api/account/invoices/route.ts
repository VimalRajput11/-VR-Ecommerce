import { api, json } from "@/server/lib/http";
import { requireUser } from "@/server/auth/session";
import { Invoice, type InvoiceDoc } from "@/server/models";
import { serialiseInvoice } from "@/server/services/billing";
import { getSettings, onlinePaymentsConfigured } from "@/server/services/settings";

export const GET = api(async () => {
  const user = await requireUser();
  const [invoices, settings] = await Promise.all([
    Invoice.find({ customerId: user.id, status: { $ne: "void" } }).sort({ issuedAt: -1 }).limit(100).lean<InvoiceDoc[]>(),
    getSettings(),
  ]);
  return json({
    invoices: invoices.map((i) => serialiseInvoice(i)),
    onlinePayments: Boolean(settings.payments?.online && onlinePaymentsConfigured()),
  });
});
