import type { NextRequest } from "next/server";
import { api, json, readJson } from "@/server/lib/http";
import { dateKey, int, objectId, oneOf, optStr } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requireUser } from "@/server/auth/session";
import { Appointment, type AppointmentDoc } from "@/server/models";
import { dayAvailability, eligibleStaff, loadBookableServices, validateBookingWindow } from "@/server/services/availability";
import { formatMinutes } from "@/lib/time";
import {
  assertWithinPolicy,
  customerCancel,
  customerRequest,
  reschedule,
  serialiseForCustomer,
  staffNameMap,
} from "@/server/services/booking";
import { getSettings } from "@/server/services/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Free times for rescheduling this appointment (its own slot is treated as free). */
export const GET = api<Ctx>(async (req: NextRequest, ctx) => {
  const user = await requireUser();
  const id = objectId((await ctx.params).id);
  const appt = await Appointment.findOne({ _id: id, customerId: user.id }).lean<AppointmentDoc>();
  if (!appt) throw notFound("Appointment not found.");
  const date = dateKey(req.nextUrl.searchParams.get("date"));
  const settings = await getSettings();
  validateBookingWindow(date, settings);
  const services = await loadBookableServices(appt.items.map((i) => i.serviceId), { online: false });
  const staff = await eligibleStaff(services);
  const slots = await dayAvailability({ dateKey: date, services, staff, settings, excludeAppointmentId: appt._id });
  return json({ slots: slots.map((s) => ({ minutes: s.minutes, label: formatMinutes(s.minutes), start: s.start })) });
});

/** Customer self-service: cancel, reschedule, or send a change request to the salon. */
export const POST = api<Ctx>(async (req: NextRequest, ctx) => {
  const user = await requireUser();
  const id = objectId((await ctx.params).id);
  const appt = await Appointment.findOne({ _id: id, customerId: user.id }).lean<AppointmentDoc>();
  if (!appt) throw notFound("Appointment not found.");

  const body = await readJson(req);
  const action = oneOf(body, "action", ["cancel", "reschedule", "request"] as const);
  const reason = optStr(body, "reason", { max: 500 });

  if (action === "cancel") {
    await customerCancel(appt, reason, user.name);
  } else if (action === "reschedule") {
    assertWithinPolicy(appt, await getSettings(), "reschedule");
    await reschedule(
      appt._id,
      { dateKey: dateKey(body.date), minutes: int(body, "minutes", { min: 0, max: 1439 }), staffId: null },
      { id: user.id, name: user.name },
      { online: true },
    );
  } else {
    await customerRequest(
      appt,
      oneOf(body, "type", ["cancel", "reschedule"] as const),
      reason,
      optStr(body, "preferredTime", { max: 200 }),
    );
  }

  const updated = await Appointment.findById(id).lean<AppointmentDoc>();
  const names = await staffNameMap([updated!.staffId]);
  return json({ appointment: serialiseForCustomer(updated!, names) });
});
