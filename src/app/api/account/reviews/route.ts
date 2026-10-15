import { api, json, readJson } from "@/server/lib/http";
import { int, objectId, optStr } from "@/server/lib/validate";
import { conflict, forbidden, notFound } from "@/server/lib/errors";
import { requireUser } from "@/server/auth/session";
import { Appointment, Review } from "@/server/models";
import { getSettings } from "@/server/services/settings";

/** Customers review their own completed appointments; reviews wait for owner moderation. */
export const POST = api(async (req) => {
  const user = await requireUser();
  const settings = await getSettings();
  if (!settings.features?.reviews) throw forbidden("Reviews are not enabled.");
  const body = await readJson(req);
  const appt = await Appointment.findOne({ _id: objectId(body.appointmentId, "appointmentId"), customerId: user.id });
  if (!appt) throw notFound("Appointment not found.");
  if (appt.status !== "completed") throw conflict("You can review an appointment once it is completed.");
  if (appt.reviewed) throw conflict("You have already reviewed this appointment.");

  const [first, ...rest] = user.name.trim().split(/\s+/);
  await Review.create({
    appointmentId: appt._id,
    customerId: user.id,
    displayName: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
    services: appt.items.map((i) => i.name),
    rating: int(body, "rating", { min: 1, max: 5, label: "Rating" }),
    comment: optStr(body, "comment", { max: 1000 }),
  });
  appt.reviewed = true;
  await appt.save();
  return json({ ok: true }, 201);
});
