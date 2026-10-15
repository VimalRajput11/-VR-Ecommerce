import { api, json, readJson } from "@/server/lib/http";
import { badRequest } from "@/server/lib/errors";
import { EMAIL_RE, hhmm, normalisePhone } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { BusinessSettings } from "@/server/models";
import { getSettings, onlinePaymentsConfigured } from "@/server/services/settings";
import { emailConfigured } from "@/server/services/notifications";
import { audit } from "@/server/services/audit";
import { parseBreaks } from "@/server/services/staff";

export const GET = api(async () => {
  await requirePermission("settings.manage");
  const settings = await getSettings();
  return json({
    settings,
    integrations: {
      onlinePayments: onlinePaymentsConfigured(),
      paymentWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      email: emailConfigured(),
      sms: false,
      whatsapp: false,
      cron: Boolean(process.env.CRON_SECRET),
    },
  });
});

type Spec = { type: "string"; max: number; pattern?: RegExp } | { type: "bool" } | { type: "int"; min: number; max: number };

// Every editable field with its validation rule. Anything not listed is ignored.
const FIELDS: Record<string, Spec> = {
  name: { type: "string", max: 100 },
  tagline: { type: "string", max: 160 },
  about: { type: "string", max: 3000 },
  logoUrl: { type: "string", max: 500 },
  "contact.phone": { type: "string", max: 20 },
  "contact.whatsapp": { type: "string", max: 20 },
  "contact.email": { type: "string", max: 200 },
  "contact.verified": { type: "bool" },
  "address.line1": { type: "string", max: 200 },
  "address.locality": { type: "string", max: 200 },
  "address.city": { type: "string", max: 80 },
  "address.state": { type: "string", max: 80 },
  "address.postalCode": { type: "string", max: 10, pattern: /^(\d{6})?$/ },
  "address.mapUrl": { type: "string", max: 500, pattern: /^(https:\/\/.*)?$/ },
  "address.verified": { type: "bool" },
  "socials.instagram": { type: "string", max: 200, pattern: /^(https:\/\/.*)?$/ },
  "socials.facebook": { type: "string", max: 200, pattern: /^(https:\/\/.*)?$/ },
  hoursVerified: { type: "bool" },
  "booking.onlineEnabled": { type: "bool" },
  "booking.slotIntervalMin": { type: "int", min: 5, max: 60 },
  "booking.minLeadMinutes": { type: "int", min: 0, max: 10080 },
  "booking.maxAdvanceDays": { type: "int", min: 1, max: 365 },
  "booking.staffSelectionEnabled": { type: "bool" },
  "booking.guestBookingEnabled": { type: "bool" },
  "booking.autoConfirm": { type: "bool" },
  "booking.requireEmail": { type: "bool" },
  "booking.cancellationCutoffHours": { type: "int", min: 0, max: 168 },
  "booking.rescheduleCutoffHours": { type: "int", min: 0, max: 168 },
  "policies.booking": { type: "string", max: 4000 },
  "policies.cancellation": { type: "string", max: 4000 },
  "tax.enabled": { type: "bool" },
  "tax.name": { type: "string", max: 20 },
  "tax.rateBps": { type: "int", min: 0, max: 5000 },
  "tax.inclusive": { type: "bool" },
  "tax.gstin": { type: "string", max: 20, pattern: /^([0-9A-Z]{15})?$/ },
  "payments.cash": { type: "bool" },
  "payments.upi": { type: "bool" },
  "payments.card": { type: "bool" },
  "payments.online": { type: "bool" },
  "payments.upiId": { type: "string", max: 100 },
  "invoice.prefix": { type: "string", max: 10, pattern: /^[A-Z0-9-]*$/ },
  "invoice.footerNote": { type: "string", max: 300 },
  "features.inventory": { type: "bool" },
  "features.retail": { type: "bool" },
  "features.loyalty": { type: "bool" },
  "features.reviews": { type: "bool" },
  "features.staffAccounts": { type: "bool" },
  "loyalty.pointsPer100": { type: "int", min: 0, max: 100 },
  "loyalty.pointValuePaise": { type: "int", min: 0, max: 100000 },
  "loyalty.minRedeemPoints": { type: "int", min: 0, max: 100000 },
  "discounts.receptionistMaxPercent": { type: "int", min: 0, max: 100 },
  "notifications.email": { type: "bool" },
  "notifications.sms": { type: "bool" },
  "notifications.whatsapp": { type: "bool" },
  "notifications.reminderHoursBefore": { type: "int", min: 1, max: 72 },
  "homepage.announcement": { type: "string", max: 200 },
};

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export const PATCH = api(async (req) => {
  const user = await requirePermission("settings.manage");
  const body = await readJson(req);
  const set: Record<string, unknown> = {};

  for (const [path, spec] of Object.entries(FIELDS)) {
    const value = get(body, path);
    if (value === undefined) continue;
    if (spec.type === "bool") {
      if (typeof value !== "boolean") throw badRequest(`${path} must be true or false.`, path);
      set[path] = value;
    } else if (spec.type === "int") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < spec.min || value > spec.max)
        throw badRequest(`${path} must be a whole number between ${spec.min} and ${spec.max}.`, path);
      set[path] = value;
    } else {
      if (typeof value !== "string" || value.length > spec.max) throw badRequest(`${path} is too long.`, path);
      const v = value.trim();
      if (spec.pattern && !spec.pattern.test(v)) throw badRequest(`${path} is not valid.`, path);
      set[path] = v;
    }
  }
  if (set.name === "") throw badRequest("Business name is required.", "name");
  for (const k of ["contact.phone", "contact.whatsapp"]) {
    if (typeof set[k] === "string" && set[k] !== "") {
      const n = normalisePhone(set[k] as string);
      if (!n) throw badRequest("Enter a valid 10-digit Indian phone number.", k);
      set[k] = n;
    }
  }
  if (typeof set["contact.email"] === "string" && set["contact.email"] !== "" && !EMAIL_RE.test(set["contact.email"] as string))
    throw badRequest("Enter a valid email.", "contact.email");

  if ("hours" in body) {
    if (!Array.isArray(body.hours) || body.hours.length !== 7) throw badRequest("Provide hours for all seven days.", "hours");
    set.hours = (body.hours as Record<string, unknown>[]).map((h, i) => {
      const closed = h.closed === true;
      const open = closed ? "10:00" : hhmm(h.open, "open");
      const close = closed ? "20:00" : hhmm(h.close, "close");
      if (!closed && close <= open) throw badRequest(`Closing time must be after opening time (${i}).`, "hours");
      return { day: i, closed, open, close, breaks: closed ? [] : parseBreaks(h.breaks ?? [], false) };
    });
  }

  await getSettings();
  await BusinessSettings.updateOne({ _id: "business" }, { $set: set }, { runValidators: true });
  await audit(user, "settings.update", "BusinessSettings", "business", `Changed: ${Object.keys(set).join(", ")}`.slice(0, 500), set);
  return json({ settings: await getSettings() });
});
