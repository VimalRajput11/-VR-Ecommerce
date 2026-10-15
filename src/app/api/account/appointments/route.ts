import { api, json } from "@/server/lib/http";
import { requireUser } from "@/server/auth/session";
import { Appointment, type AppointmentDoc } from "@/server/models";
import { serialiseForCustomer, staffNameMap } from "@/server/services/booking";
import { getSettings } from "@/server/services/settings";

export const GET = api(async () => {
  const user = await requireUser();
  const now = new Date();
  const [upcoming, past, settings] = await Promise.all([
    Appointment.find({ customerId: user.id, end: { $gte: now }, status: { $nin: ["cancelled", "no_show", "completed"] } })
      .sort({ start: 1 })
      .limit(50)
      .lean<AppointmentDoc[]>(),
    Appointment.find({
      customerId: user.id,
      $or: [{ end: { $lt: now } }, { status: { $in: ["cancelled", "no_show", "completed"] } }],
    })
      .sort({ start: -1 })
      .limit(50)
      .lean<AppointmentDoc[]>(),
    getSettings(),
  ]);
  const names = await staffNameMap([...upcoming, ...past].map((a) => a.staffId));
  return json({
    upcoming: upcoming.map((a) => serialiseForCustomer(a, names)),
    past: past.map((a) => serialiseForCustomer(a, names)),
    policy: {
      cancellationCutoffHours: settings.booking?.cancellationCutoffHours ?? 0,
      rescheduleCutoffHours: settings.booking?.rescheduleCutoffHours ?? 0,
      reviewsEnabled: !!settings.features?.reviews,
    },
  });
});
