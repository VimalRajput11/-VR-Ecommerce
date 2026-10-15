import { Types } from "mongoose";
import { api, json, readJson } from "@/server/lib/http";
import {
  dateKey,
  escapeRegex,
  int,
  isObjectId,
  objectIdArray,
  oneOf,
  optEmail,
  optObjectId,
  optStr,
  pagination,
  phone,
  str,
} from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { Appointment, type AppointmentDoc } from "@/server/models";
import { APPOINTMENT_STATUSES } from "@/lib/constants";
import { addDaysToKey, istToUtc } from "@/lib/time";
import { createBooking, serialiseForStaff, staffNameMap } from "@/server/services/booking";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  const user = await requirePermission("appointments.view_all", "appointments.view_own");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};

  if (p.get("from") || p.get("to")) {
    const from = p.get("from") ? dateKey(p.get("from"), "from") : null;
    const to = p.get("to") ? dateKey(p.get("to"), "to") : null;
    filter.start = {
      ...(from ? { $gte: istToUtc(from, 0) } : {}),
      ...(to ? { $lt: istToUtc(addDaysToKey(to, 1), 0) } : {}),
    };
  }
  const status = p.get("status");
  if (status && (APPOINTMENT_STATUSES as readonly string[]).includes(status)) filter.status = status;
  if (p.get("requests") === "1") Object.assign(filter, { "request.type": { $exists: true }, "request.resolved": false });
  const service = p.get("service");
  if (service && isObjectId(service)) filter["items.serviceId"] = new Types.ObjectId(service);
  const customer = p.get("customer");
  if (customer && isObjectId(customer)) filter.customerId = new Types.ObjectId(customer);

  // Stylists without "view all" only ever see their own appointments.
  const staff = p.get("staff");
  if (!user.permissions.includes("appointments.view_all")) filter.staffId = new Types.ObjectId(user.id);
  else if (staff && isObjectId(staff)) filter.staffId = new Types.ObjectId(staff);

  const q = p.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
    filter.$or = [{ ref: rx }, { "customer.name": rx }, { "customer.phone": rx }];
  }

  const { page, limit, skip } = pagination(p, 50);
  const sort = p.get("sort") === "desc" ? -1 : 1;
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ start: sort }).skip(skip).limit(limit).lean<AppointmentDoc[]>(),
    Appointment.countDocuments(filter),
  ]);
  const names = await staffNameMap(items.map((a) => a.staffId));
  const opts = {
    internal: user.permissions.includes("appointments.internal_notes"),
    contact: user.permissions.includes("customers.view"),
  };
  return json({ items: items.map((a) => serialiseForStaff(a, names, opts)), total, page, limit });
});

/** Walk-in / phone bookings made by the front desk or owner. */
export const POST = api(async (req) => {
  const user = await requirePermission("appointments.manage");
  const body = await readJson(req);
  const source = oneOf(body, "source", ["walk_in", "phone", "staff"] as const);
  const appt = await createBooking({
    serviceIds: objectIdArray(body, "serviceIds", { min: 1, max: 10 }),
    staffId: optObjectId(body, "staffId") ?? null,
    dateKey: dateKey(body.date),
    minutes: int(body, "minutes", { min: 0, max: 1439 }),
    customer: {
      userId: isObjectId(body.customerId) ? body.customerId : undefined,
      name: str(body, "name", { max: 100, label: "Name" }),
      phone: phone(body),
      email: optEmail(body),
    },
    notes: optStr(body, "notes", { max: 500 }),
    source,
    actor: { id: user.id, name: user.name },
    initialStatus: body.checkIn === true ? "checked_in" : "confirmed",
  });
  await audit(user, "appointment.create", "Appointment", String(appt._id), `Booked ${appt.ref} (${source}) for ${appt.customer.name}`);
  const names = await staffNameMap([appt.staffId]);
  return json({ appointment: serialiseForStaff(appt.toObject(), names, { internal: true, contact: true }) }, 201);
});
