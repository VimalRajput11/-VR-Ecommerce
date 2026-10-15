import { api, json, readJson } from "@/server/lib/http";
import { optStr } from "@/server/lib/validate";
import { findGuestAppointment } from "@/server/services/guest";
import { customerCancel, customerRequest, serialiseForCustomer, staffNameMap } from "@/server/services/booking";
import { ApiError } from "@/server/lib/errors";

export const POST = api(async (req) => {
  const body = await readJson(req);
  const appt = await findGuestAppointment(req, body);
  const reason = optStr(body, "reason", { max: 500 });
  try {
    const updated = await customerCancel(appt, reason, appt.customer.name);
    const names = await staffNameMap([updated.staffId]);
    return json({ appointment: serialiseForCustomer(updated.toObject(), names), cancelled: true });
  } catch (err) {
    // Inside the cutoff window: record a request for the salon to handle instead.
    if (err instanceof ApiError && err.code === "policy" && body.requestIfLate === true) {
      await customerRequest(appt, "cancel", reason, undefined);
      return json({ cancelled: false, requested: true });
    }
    throw err;
  }
});
