import { Types } from "mongoose";
import { api, json } from "@/server/lib/http";
import { dateKey, isObjectId, objectId } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { dayAvailability, eligibleStaff, loadBookableServices } from "@/server/services/availability";
import { getSettings } from "@/server/services/settings";
import { formatMinutes } from "@/lib/time";

/** Free times for front-desk bookings (no online lead time; offline-only services allowed). */
export const GET = api(async (req) => {
  await requirePermission("appointments.manage");
  const p = req.nextUrl.searchParams;
  const date = dateKey(p.get("date"));
  const ids = (p.get("services") ?? "").split(",").filter(Boolean).slice(0, 20).map((id) => objectId(id, "services"));
  const staffParam = p.get("staff");
  const exclude = p.get("exclude");
  const settings = await getSettings();
  const services = await loadBookableServices(ids, { online: false });
  const staff = await eligibleStaff(services, staffParam && isObjectId(staffParam) ? new Types.ObjectId(staffParam) : null);
  const slots = await dayAvailability({
    dateKey: date,
    services,
    staff,
    settings,
    forStaff: true,
    excludeAppointmentId: exclude && isObjectId(exclude) ? new Types.ObjectId(exclude) : undefined,
  });
  return json({
    staff: staff.map((s) => ({ id: String(s._id), name: s.name })),
    slots: slots.map((s) => ({ minutes: s.minutes, label: formatMinutes(s.minutes), staffIds: s.staffIds })),
  });
});
