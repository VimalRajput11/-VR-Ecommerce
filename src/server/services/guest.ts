import { Appointment, type AppointmentDoc } from "@/server/models";
import { notFound } from "@/server/lib/errors";
import { phone, str } from "@/server/lib/validate";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";

/**
 * Guests access their booking with the booking reference *and* the phone number used,
 * sent in a POST body (never in the URL). Rate limited to prevent enumeration.
 */
export async function findGuestAppointment(req: Request, body: Record<string, unknown>): Promise<AppointmentDoc> {
  rateLimit(`lookup:${clientIp(req)}`, 15, 15 * 60_000);
  const ref = str(body, "ref", { max: 12, label: "Booking reference" }).toUpperCase().replace(/\s/g, "");
  const ph = phone(body);
  const appt = await Appointment.findOne({ ref, "customer.phone": ph }).lean<AppointmentDoc>();
  if (!appt) throw notFound("We couldn't find a booking with that reference and phone number.");
  return appt;
}
