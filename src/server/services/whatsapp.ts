import { randomBytes } from "node:crypto";
import { Invoice, Notification } from "@/server/models";
import { SALON_MAP_URL } from "@/server/models/settings";
import { getSettings, salonPhone, type Settings } from "./settings";
import { formatINR } from "@/lib/money";
import { formatPhone } from "@/lib/format";
import { formatDate } from "@/lib/time";

// WhatsApp messages to customers, in two modes:
//
// 1. Tap-to-send (always available, free): we build a https://wa.me/<number>?text=... link. Staff
//    open it on the salon phone/computer, WhatsApp opens with the message written, they press Send.
// 2. WhatsApp Business Platform (Meta Cloud API): sends automatically from the dashboard. Only
//    active when WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are set. Meta only allows pre-approved
//    templates for business-initiated messages, so the API path sends template parameters (see
//    README "WhatsApp") while the tap-to-send path sends the full text below.
//
// Every send is recorded as a Notification (channel "whatsapp") so the dashboard can show who
// has already received an invoice or offer, and the dedupe key stops double-sends.

const GRAPH_VERSION = "v21.0";

export function whatsappApiConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Public base URL for links in messages (no trailing slash). */
export function siteUrl(fallbackOrigin?: string) {
  return (process.env.NEXT_PUBLIC_SITE_URL || fallbackOrigin || "http://localhost:3000").replace(/\/+$/, "");
}

/** 10-digit Indian mobile → 91XXXXXXXXXX (the format both wa.me and the Cloud API expect). */
export function waNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const to = waNumber(phone);
  return to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : null;
}

/** First name, capitalised ("vimal rajput" → "Vimal"). */
const firstName = (name?: string | null) => {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first[0].toUpperCase() + first.slice(1) : "there";
};

// ---------------------------------------------------------------- invoice links

/** Unguessable link token so customers (including guests without an account) can open their invoice. */
export async function invoiceShareToken(invoiceId: unknown): Promise<string> {
  const inv = await Invoice.findById(invoiceId).select("shareToken").lean<{ shareToken?: string }>();
  if (inv?.shareToken) return inv.shareToken;
  const token = randomBytes(18).toString("base64url");
  // Only set it if still missing, so two concurrent calls agree on one token.
  await Invoice.updateOne({ _id: invoiceId, shareToken: { $exists: false } }, { $set: { shareToken: token } });
  const saved = await Invoice.findById(invoiceId).select("shareToken").lean<{ shareToken?: string }>();
  return saved?.shareToken ?? token;
}

export async function invoiceShareUrl(invoiceId: unknown, fallbackOrigin?: string) {
  return `${siteUrl(fallbackOrigin)}/i/${await invoiceShareToken(invoiceId)}`;
}

// ---------------------------------------------------------------- message text

interface InvoiceLike {
  _id: unknown;
  number: string;
  total: number;
  balanceDue: number;
  customerId: unknown;
  customer?: { name?: string | null; phone?: string | null } | null;
  lines?: { kind: string; amount: number; giftCardCode?: string | null }[];
}

export function invoiceMessage(inv: InvoiceLike, url: string, settings: Settings, base: string) {
  const due = inv.balanceDue > 0 ? `\nBalance due: ${formatINR(inv.balanceDue)}` : "";
  return [
    `Thank you for visiting ${settings.name} ✨`,
    "",
    `Dear ${firstName(inv.customer?.name)},`,
    "",
    `It was a pleasure having you with us today! Your invoice ${inv.number} for today's services is ${formatINR(inv.total)}.${due}`,
    "",
    `View or download your invoice:\n${url}`,
    "",
    // Gift cards bought on this bill: the code is what the customer needs.
    ...(inv.lines ?? [])
      .filter((l) => l.kind === "giftcard" && l.giftCardCode)
      .flatMap((l) => [`🎁 Your gift card: *${l.giftCardCode}* worth ${formatINR(l.amount)}`, ""]),
    `Plan your next visit:\n${base}/book`,
    "",
    "We look forward to welcoming you back soon!",
    "",
    `With gratitude,\nYour ${settings.name} family`,
    `📞 ${formatPhone(salonPhone(settings))}`,
  ].join("\n");
}

/** Gift card message: the code, value, expiry and how to use it. */
export function giftCardMessage(card: { code: string; balance: number; initialValue: number; expiresAt?: Date | null }, settings: Settings, base: string, name?: string | null) {
  const partlyUsed = card.balance < card.initialValue;
  return [
    `🎁 A gift card from ${settings.name} ✨`,
    "",
    `Hi ${firstName(name)},`,
    "",
    `Here is your gift card ${partlyUsed ? "with" : "worth"} *${formatINR(card.balance)}*${partlyUsed ? " left" : ""}.`,
    `Code: *${card.code}*`,
    card.expiresAt ? `Valid till ${formatDate(card.expiresAt)}.` : "No expiry date.",
    "",
    "Show this code at the salon when you pay. Anything you don't use stays on the card for next time.",
    "",
    `📅 Book your visit: ${base}/book`,
    `📞 ${formatPhone(salonPhone(settings))}`,
    `📍 ${settings.address?.mapUrl || SALON_MAP_URL}`,
    "",
    `With love,\nYour ${settings.name} family`,
  ].join("\n");
}

interface CouponLike {
  _id: unknown;
  code: string;
  title: string;
  description?: string | null;
  type: "percent" | "flat";
  value: number;
  maxDiscount?: number | null;
  minSubtotal?: number | null;
  endsAt: Date | string;
}

/** e.g. "Flat 25% OFF (up to ₹500) on bills above ₹1,000" */
export function offerDiscountText(c: CouponLike) {
  const amount = c.type === "percent" ? `Flat ${c.value}% OFF` : `Flat ${formatINR(c.value)} OFF`;
  const cap = c.type === "percent" && c.maxDiscount ? ` (up to ${formatINR(c.maxDiscount)})` : "";
  const min = c.minSubtotal ? ` on bills above ${formatINR(c.minSubtotal)}` : "";
  return `${amount}${cap}${min}`;
}

/** Default offer text; `{name}` is replaced with each customer's first name when sending. */
export function offerMessageTemplate(c: CouponLike, settings: Settings, base: string) {
  const lines = [
    `✨ ${c.title} – ${settings.name}`,
    "",
    "Hi {name},",
    "",
  ];
  if (c.description) lines.push(c.description, "");
  lines.push(
    `🎁 ${offerDiscountText(c)}`,
    `Use code *${c.code}* at the salon. Valid till ${formatDate(c.endsAt)}.`,
    "",
    `📅 Book now: ${base}/book`,
    `📞 Call us: ${formatPhone(salonPhone(settings))}`,
  );
  lines.push(`📍 Get directions: ${settings.address?.mapUrl || SALON_MAP_URL}`);
  lines.push("", "Reply STOP if you'd rather not receive offers.");
  return lines.join("\n");
}

export const personalise = (text: string, name?: string | null) => text.replaceAll("{name}", firstName(name));

// ---------------------------------------------------------------- Cloud API

/** Template parameters may not contain newlines, tabs or long runs of spaces. */
const param = (text: string) => ({ type: "text", text: text.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 1000) || "-" });

async function sendTemplate(to: string, template: string, bodyParams: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappApiConfigured()) return { ok: false, error: "WhatsApp Business API not configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: bodyParams.map(param) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, error: `WhatsApp API ${res.status}: ${detail?.error?.message ?? "request failed"}`.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "WhatsApp send failed" };
  }
}

/** Reserves the dedupe key; returns false if this message was already sent (or is being sent). */
async function reserve(key: string, data: { userId: unknown; event: string; to: string; subject: string; body: string; link?: string; status?: string }) {
  try {
    await Notification.create({ ...data, channel: "whatsapp", status: data.status ?? "pending", dedupeKey: key });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    // A failed earlier attempt may be retried; anything else counts as already sent.
    const retried = await Notification.updateOne({ dedupeKey: key, status: "failed" }, { $set: { status: data.status ?? "pending", error: null, body: data.body } });
    return retried.modifiedCount === 1;
  }
}

async function finish(key: string, result: { ok: boolean; error?: string }) {
  await Notification.updateOne({ dedupeKey: key }, { status: result.ok ? "sent" : "failed", error: result.error });
}

type SendResult = { ok: boolean; error?: string; alreadySent?: boolean };

export const invoiceKey = (invoiceId: unknown) => `invoice_whatsapp:${String(invoiceId)}`;
export const offerKey = (couponId: unknown, customerId: unknown) => `offer_whatsapp:${String(couponId)}:${String(customerId)}`;

/** Sends the invoice through the Cloud API. Used automatically after billing and from the dashboard. */
export async function sendInvoiceWhatsApp(inv: InvoiceLike, opts: { fallbackOrigin?: string } = {}): Promise<SendResult> {
  const to = waNumber(inv.customer?.phone);
  if (!to) return { ok: false, error: "Customer has no valid mobile number" };
  const settings = await getSettings();
  const url = await invoiceShareUrl(inv._id, opts.fallbackOrigin);
  const key = invoiceKey(inv._id);
  const reserved = await reserve(key, {
    userId: inv.customerId,
    event: "invoice_whatsapp",
    to,
    subject: `Invoice ${inv.number}`,
    body: invoiceMessage(inv, url, settings, siteUrl(opts.fallbackOrigin)),
    link: url,
  });
  if (!reserved) return { ok: true, alreadySent: true };
  // Template "invoice": {{1}} first name, {{2}} invoice number, {{3}} amount, {{4}} invoice link.
  const result = await sendTemplate(to, process.env.WHATSAPP_INVOICE_TEMPLATE || "invoice_receipt", [
    firstName(inv.customer?.name),
    inv.number,
    formatINR(inv.total),
    url,
  ]);
  await finish(key, result);
  return result;
}

/** Never throws: called right after an invoice is issued, so a WhatsApp failure must not break billing. */
export async function autoSendInvoiceWhatsApp(inv: InvoiceLike) {
  try {
    if (!whatsappApiConfigured()) return;
    const settings = await getSettings();
    if (!settings.notifications?.whatsapp) return;
    await sendInvoiceWhatsApp(inv);
  } catch (err) {
    console.error("[whatsapp] invoice", err);
  }
}

/** Records a tap-to-send message so the dashboard shows it as sent. */
export async function recordManualWhatsApp(key: string, data: { userId: unknown; event: string; to: string; subject: string; body: string; link?: string }) {
  const fresh = await reserve(key, { ...data, status: "sent" });
  if (!fresh) await Notification.updateOne({ dedupeKey: key }, { $set: { status: "sent", body: data.body } });
}

export async function sendOfferWhatsApp(coupon: CouponLike, customer: { _id: unknown; name: string; phone?: string | null }, settings: Settings, base: string): Promise<SendResult> {
  const to = waNumber(customer.phone);
  if (!to) return { ok: false, error: "No valid mobile number" };
  const key = offerKey(coupon._id, customer._id);
  const reserved = await reserve(key, {
    userId: customer._id,
    event: "offer_whatsapp",
    to,
    subject: coupon.title,
    body: personalise(offerMessageTemplate(coupon, settings, base), customer.name),
  });
  if (!reserved) return { ok: true, alreadySent: true };
  // Template "offer": {{1}} first name, {{2}} offer title, {{3}} discount, {{4}} code, {{5}} valid till.
  const result = await sendTemplate(to, process.env.WHATSAPP_OFFER_TEMPLATE || "salon_offer", [
    firstName(customer.name),
    coupon.title,
    offerDiscountText(coupon),
    coupon.code,
    formatDate(coupon.endsAt),
  ]);
  await finish(key, result);
  return result;
}
