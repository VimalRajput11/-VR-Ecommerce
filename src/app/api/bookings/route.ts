import { api, json, readJson } from "@/server/lib/http";
import { dateKey, int, objectIdArray, oneOf, optEmail, optObjectId, optStr, phone, str } from "@/server/lib/validate";
import { badRequest, unauthorized } from "@/server/lib/errors";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { getSessionUser } from "@/server/auth/session";
import { createBooking, serialiseForCustomer, staffNameMap } from "@/server/services/booking";
import { getSettings } from "@/server/services/settings";

export const POST = api(async (req) => {
  rateLimit(`booking:${clientIp(req)}`, 12, 10 * 60_000);
  const body = await readJson(req);
  const user = await getSessionUser();
  const settings = await getSettings();
  if (!user && !settings.booking?.guestBookingEnabled) throw unauthorized("Please sign in to book an appointment.");

  const customerEmail = optEmail(body);
  if (settings.booking?.requireEmail && !customerEmail) throw badRequest("Email is required.", "email");
  const idempotencyKey = optStr(body, "idempotencyKey", { max: 100, pattern: /^[A-Za-z0-9_-]+$/ });

  const appt = await createBooking({
    serviceIds: objectIdArray(body, "serviceIds", { min: 1, max: 10 }),
    staffId: optObjectId(body, "staffId") ?? null,
    dateKey: dateKey(body.date),
    minutes: int(body, "minutes", { min: 0, max: 24 * 60 - 1 }),
    customer: {
      userId: user?.id,
      name: str(body, "name", { max: 100, label: "Name" }),
      phone: phone(body),
      email: customerEmail ?? user?.email,
    },
    notes: optStr(body, "notes", { max: 500 }),
    source: "online",
    paymentPreference: oneOf(body, "paymentPreference", ["pay_at_salon", "online"] as const, { optional: true }) ?? "pay_at_salon",
    actor: user ? { id: user.id, name: user.name } : null,
    idempotencyKey: idempotencyKey ? `${user?.id ?? "guest"}:${idempotencyKey}` : undefined,
  });
  const names = await staffNameMap([appt.staffId]);
  return json({ appointment: serialiseForCustomer(appt.toObject(), names) }, 201);
});
