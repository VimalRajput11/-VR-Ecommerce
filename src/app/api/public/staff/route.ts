import { api, json } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { eligibleStaff, loadBookableServices } from "@/server/services/availability";
import { getSettings } from "@/server/services/settings";

// Stylists customers can choose from (names and titles only).
export const GET = api(async (req) => {
  const settings = await getSettings();
  if (!settings.booking?.staffSelectionEnabled) return json({ staff: [], selectionEnabled: false });
  const ids = (req.nextUrl.searchParams.get("services") ?? "").split(",").filter(Boolean).slice(0, 20);
  const services = await loadBookableServices(ids.map((id) => objectId(id, "services")), { online: true });
  const staff = await eligibleStaff(services);
  return json({
    selectionEnabled: true,
    staff: staff.map((s) => ({ id: String(s._id), name: s.name, title: s.staff?.title ?? "" })),
  });
});
