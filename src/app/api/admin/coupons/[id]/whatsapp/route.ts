import { api, json, readJson } from "@/server/lib/http";
import { int, objectId, oneOf, str } from "@/server/lib/validate";
import { badRequest, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import type { Types } from "mongoose";
import { Coupon, Invoice, Notification, User, type CouponDoc } from "@/server/models";
import { getSettings } from "@/server/services/settings";
import { audit } from "@/server/services/audit";
import {
  offerKey,
  offerMessageTemplate,
  personalise,
  recordManualWhatsApp,
  sendOfferWhatsApp,
  siteUrl,
  waNumber,
  whatsappApiConfigured,
} from "@/server/services/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

// Bulk API sends are done in small batches so each request stays well inside serverless time limits;
// the dashboard keeps calling until nothing is left.
const BATCH = 20;
export const maxDuration = 60;

async function loadCoupon(id: ReturnType<typeof objectId>) {
  const coupon = await Coupon.findById(id).lean<CouponDoc>();
  if (!coupon) throw notFound("Offer not found.");
  return coupon;
}

/**
 * Customers with a mobile number who visited the salon (optionally within the last `days`): either a
 * completed appointment (lastVisitAt) or a bill in that period, since walk-ins are often billed
 * without an appointment. Also returns each customer's latest bill date for display.
 */
async function visitedFilter(days: number) {
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const billed = await Invoice.aggregate<{ _id: Types.ObjectId; last: Date }>([
    { $match: { status: { $ne: "void" }, ...(since ? { issuedAt: { $gte: since } } : {}) } },
    { $group: { _id: "$customerId", last: { $max: "$issuedAt" } } },
  ]);
  const filter: Record<string, unknown> = {
    role: "customer",
    active: { $ne: false },
    phone: { $type: "string", $ne: "" },
    $or: [{ lastVisitAt: since ? { $gte: since } : { $type: "date" } }, { _id: { $in: billed.map((b) => b._id) } }],
  };
  return { filter, lastBill: new Map(billed.map((b) => [String(b._id), b.last])) };
}

const daysParam = (v: string | null) => Math.max(0, Math.min(3650, Number(v) || 0));

export const GET = api<Ctx>(async (req, ctx) => {
  await requirePermission("offers.manage");
  const coupon = await loadCoupon(objectId((await ctx.params).id));
  const days = daysParam(req.nextUrl.searchParams.get("days"));
  const settings = await getSettings();
  const { filter, lastBill } = await visitedFilter(days);
  const lastVisit = (c: { _id: unknown; lastVisitAt?: Date | null }) => {
    const bill = lastBill.get(String(c._id));
    return c.lastVisitAt && (!bill || c.lastVisitAt > bill) ? c.lastVisitAt : (bill ?? null);
  };
  const customers = (await User.find(filter).select("name phone lastVisitAt marketingConsent").limit(1000).lean()).sort(
    (a, b) => (lastVisit(b)?.getTime() ?? 0) - (lastVisit(a)?.getTime() ?? 0),
  );
  const sent = await Notification.find({ dedupeKey: { $in: customers.map((c) => offerKey(coupon._id, c._id)) } })
    .select("dedupeKey status error updatedAt")
    .lean();
  const sentMap = new Map(sent.map((n) => [n.dedupeKey, n]));
  return json({
    message: offerMessageTemplate(coupon, settings, siteUrl(req.nextUrl.origin)),
    apiConfigured: whatsappApiConfigured(),
    recipients: customers
      .filter((c) => waNumber(c.phone))
      .map((c) => {
        const n = sentMap.get(offerKey(coupon._id, c._id));
        return {
          id: String(c._id),
          name: c.name,
          phone: c.phone,
          lastVisitAt: lastVisit(c),
          marketingConsent: !!c.marketingConsent,
          status: n?.status ?? null,
          error: n?.error ?? null,
          sentAt: n?.updatedAt ?? null,
        };
      }),
  });
});

export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("offers.manage");
  const coupon = await loadCoupon(objectId((await ctx.params).id));
  const body = await readJson(req);
  const action = oneOf(body, "action", ["opened", "send"] as const);

  if (action === "opened") {
    // Staff opened WhatsApp with the message for one customer; remember it so the list shows "Sent".
    const customer = await User.findOne({ _id: objectId(String(body.customerId ?? ""), "customerId"), role: "customer" }).select("name phone").lean();
    const to = waNumber(customer?.phone);
    if (!customer || !to) throw badRequest("This customer has no valid mobile number.");
    const message = str(body, "message", { max: 3000, label: "Message" });
    await recordManualWhatsApp(offerKey(coupon._id, customer._id), {
      userId: customer._id,
      event: "offer_whatsapp",
      to,
      subject: coupon.title,
      body: personalise(message, customer.name),
    });
    return json({ ok: true });
  }

  // Business API: only customers who agreed to receive offers (WhatsApp policy for marketing messages).
  if (!whatsappApiConfigured()) throw badRequest("The WhatsApp Business API is not connected. Use the \"Open WhatsApp\" buttons instead.");
  const days = int(body, "days", { min: 0, max: 3650, label: "Days" });
  const settings = await getSettings();
  const base = siteUrl(req.nextUrl.origin);
  const { filter } = await visitedFilter(days);
  const candidates = await User.find({ ...filter, marketingConsent: true }).select("name phone").sort({ lastVisitAt: -1 }).limit(1000).lean();
  // Anyone already attempted (sent, in progress or failed) is skipped, so repeated batches always
  // finish; a failed customer can still be sent to individually with "Open WhatsApp".
  const done = new Set(
    (await Notification.find({ dedupeKey: { $in: candidates.map((c) => offerKey(coupon._id, c._id)) } }).select("dedupeKey").lean()).map((n) => n.dedupeKey),
  );
  const todo = candidates.filter((c) => waNumber(c.phone) && !done.has(offerKey(coupon._id, c._id)));
  let sentCount = 0;
  let failed = 0;
  for (const c of todo.slice(0, BATCH)) {
    const result = await sendOfferWhatsApp(coupon, c, settings, base);
    if (result.ok) sentCount++;
    else failed++;
  }
  if (sentCount || failed) await audit(user, "coupon.whatsapp", "Coupon", String(coupon._id), `WhatsApp offer ${coupon.code}: ${sentCount} sent, ${failed} failed`);
  return json({ sent: sentCount, failed, remaining: Math.max(0, todo.length - BATCH) });
});
