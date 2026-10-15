import { api, json } from "@/server/lib/http";
import { dateKey, objectId } from "@/server/lib/validate";
import { clientIp, rateLimit } from "@/server/lib/rateLimit";
import { dayAvailability, eligibleStaff, loadBookableServices, validateBookingWindow } from "@/server/services/availability";
import { getSettings } from "@/server/services/settings";
import { formatMinutes } from "@/lib/time";

export const GET = api(async (req) => {
  rateLimit(`availability:${clientIp(req)}`, 120, 60_000);
  const params = req.nextUrl.searchParams;
  const date = dateKey(params.get("date"));
  const ids = (params.get("services") ?? "").split(",").filter(Boolean).slice(0, 20);
  const staffParam = params.get("staff");

  const settings = await getSettings();
  if (!settings.booking?.onlineEnabled) return json({ slots: [], reason: "Online booking is currently unavailable." });
  validateBookingWindow(date, settings);

  const services = await loadBookableServices(ids.map((id) => objectId(id, "services")), { online: true });
  const staffId = settings.booking?.staffSelectionEnabled && staffParam ? objectId(staffParam, "staff") : null;
  const staff = await eligibleStaff(services, staffId);
  const slots = await dayAvailability({ dateKey: date, services, staff, settings });
  return json({
    slots: slots.map((s) => ({ minutes: s.minutes, label: formatMinutes(s.minutes), start: s.start })),
    reason: slots.length ? null : staff.length ? "No free times on this day. Please try another date." : "No stylist is currently available for this combination of services.",
  });
});
