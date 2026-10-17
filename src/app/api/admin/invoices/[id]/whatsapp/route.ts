import { api, json, readJson } from "@/server/lib/http";
import { objectId, oneOf, optStr } from "@/server/lib/validate";
import { badRequest, conflict, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Invoice, Notification, type InvoiceDoc } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { audit } from "@/server/services/audit";
import {
  invoiceKey,
  invoiceMessage,
  invoiceShareUrl,
  recordManualWhatsApp,
  sendInvoiceWhatsApp,
  siteUrl,
  waLink,
  waNumber,
  whatsappApiConfigured,
} from "@/server/services/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: ReturnType<typeof objectId>) {
  const invoice = await Invoice.findById(id).lean<InvoiceDoc>();
  if (!invoice) throw notFound("Invoice not found.");
  return invoice;
}

/** Message preview, tap-to-send link and delivery status for the invoice page. */
export const GET = api<Ctx>(async (req, ctx) => {
  await requirePermission("billing.manage");
  const invoice = await load(objectId((await ctx.params).id));
  const [settings, url, sent] = await Promise.all([
    getSettings(),
    invoiceShareUrl(invoice._id, req.nextUrl.origin),
    Notification.findOne({ dedupeKey: invoiceKey(invoice._id) }).select("status error updatedAt").lean(),
  ]);
  const message = invoiceMessage(invoice, url, settings, siteUrl(req.nextUrl.origin));
  return json({
    phone: invoice.customer?.phone ?? "",
    validPhone: !!waNumber(invoice.customer?.phone),
    url,
    message,
    link: waLink(invoice.customer?.phone, message),
    apiConfigured: whatsappApiConfigured(),
    last: sent ? { status: sent.status, error: sent.error ?? null, at: sent.updatedAt } : null,
  });
});

/** action "opened": staff sent it through WhatsApp themselves; action "send": send via the Business API. */
export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("billing.manage");
  const invoice = await load(objectId((await ctx.params).id));
  if (invoice.status === "void") throw conflict("This invoice is void.");
  const to = waNumber(invoice.customer?.phone);
  if (!to) throw badRequest("This customer has no valid mobile number.");
  const body = await readJson(req);
  const action = oneOf(body, "action", ["opened", "send"] as const);

  if (action === "opened") {
    const settings = await getSettings();
    const url = await invoiceShareUrl(invoice._id, req.nextUrl.origin);
    await recordManualWhatsApp(invoiceKey(invoice._id), {
      userId: invoice.customerId,
      event: "invoice_whatsapp",
      to,
      subject: `Invoice ${invoice.number}`,
      // Staff may edit the message before sending; store what was actually sent.
      body: optStr(body, "message", { max: 3000 }) ?? invoiceMessage(invoice, url, settings, siteUrl(req.nextUrl.origin)),
      link: url,
    });
    return json({ ok: true });
  }

  if (!whatsappApiConfigured()) throw badRequest("The WhatsApp Business API is not connected. Use \"Open WhatsApp\" instead.");
  // Resending is allowed from the dashboard, so clear the previous record first.
  await Notification.deleteOne({ dedupeKey: invoiceKey(invoice._id) });
  const result = await sendInvoiceWhatsApp(invoice, { fallbackOrigin: req.nextUrl.origin });
  await audit(user, "invoice.whatsapp", "Invoice", String(invoice._id), `WhatsApp ${result.ok ? "sent" : "failed"} for ${invoice.number}`);
  if (!result.ok) throw badRequest(result.error ?? "WhatsApp send failed.");
  return json({ ok: true });
});
