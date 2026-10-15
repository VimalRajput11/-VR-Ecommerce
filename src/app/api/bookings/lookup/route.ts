import { api, json, readJson } from "@/server/lib/http";
import { findGuestAppointment } from "@/server/services/guest";
import { serialiseForCustomer, staffNameMap } from "@/server/services/booking";

export const POST = api(async (req) => {
  const body = await readJson(req);
  const appt = await findGuestAppointment(req, body);
  const names = await staffNameMap([appt.staffId]);
  return json({ appointment: serialiseForCustomer(appt, names) });
});
