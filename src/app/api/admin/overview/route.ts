import { Types } from "mongoose";
import { api, json } from "@/server/lib/http";
import { dateKey } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { Appointment, ContactMessage, JobApplication, Review, Service, type AppointmentDoc } from "@/server/models";
import { addDaysToKey, dateKeyIST, istToUtc } from "@/lib/time";
import { serialiseForStaff, staffNameMap } from "@/server/services/booking";
import {
  appointmentStats,
  dailySeries,
  lowStock,
  outstandingBalance,
  popularServices,
  salesSummary,
  staffWorkload,
} from "@/server/services/reports";
import { getSettings } from "@/server/services/settings";

export const GET = api(async (req) => {
  const user = await requirePermission("dashboard.view");
  const params = req.nextUrl.searchParams;
  const today = dateKeyIST();
  const from = params.get("from") ? dateKey(params.get("from"), "from") : addDaysToKey(today, -29);
  const to = params.get("to") ? dateKey(params.get("to"), "to") : today;
  const range = { from: istToUtc(from, 0), to: istToUtc(addDaysToKey(to, 1), 0) };
  const todayRange = { from: istToUtc(today, 0), to: istToUtc(addDaysToKey(today, 1), 0) };
  const monthStart = `${today.slice(0, 8)}01`;
  const monthRange = { from: istToUtc(monthStart, 0), to: todayRange.to };

  const seeAll = user.permissions.includes("appointments.view_all");
  const ownFilter = seeAll ? {} : { staffId: new Types.ObjectId(user.id) };
  const settings = await getSettings();

  const [todayList, upcomingCount, todayStats, rangeStats] = await Promise.all([
    Appointment.find({ ...ownFilter, start: { $gte: todayRange.from, $lt: todayRange.to } }).sort({ start: 1 }).limit(100).lean<AppointmentDoc[]>(),
    Appointment.countDocuments({ ...ownFilter, start: { $gte: todayRange.to, $lt: istToUtc(addDaysToKey(today, 8), 0) }, status: { $in: ["pending", "confirmed"] } }),
    appointmentStats(todayRange, seeAll ? undefined : new Types.ObjectId(user.id)),
    appointmentStats(range, seeAll ? undefined : new Types.ObjectId(user.id)),
  ]);
  const names = await staffNameMap(todayList.map((a) => a.staffId));
  const contact = user.permissions.includes("customers.view");

  const result: Record<string, unknown> = {
    range: { from, to },
    today: {
      stats: todayStats,
      appointments: todayList.map((a) => serialiseForStaff(a, names, { internal: false, contact })),
    },
    upcomingCount,
    rangeStats,
  };

  if (seeAll) {
    const [pendingRequests, pendingConfirm, newMessages, pendingReviews, unverifiedPrices, popular, workload, newApplications] = await Promise.all([
      Appointment.countDocuments({ "request.type": { $exists: true }, "request.resolved": false, status: { $in: ["pending", "confirmed"] } }),
      Appointment.countDocuments({ status: "pending", start: { $gte: new Date() } }),
      user.permissions.includes("messages.view") ? ContactMessage.countDocuments({ status: "new" }) : 0,
      user.permissions.includes("reviews.moderate") ? Review.countDocuments({ status: "pending" }) : 0,
      user.permissions.includes("services.manage") ? Service.countDocuments({ archived: { $ne: true }, active: true, priceVerified: false }) : 0,
      popularServices(range),
      staffWorkload(range),
      user.permissions.includes("careers.manage") ? JobApplication.countDocuments({ status: "new" }) : 0,
    ]);
    Object.assign(result, { alerts: { pendingRequests, pendingConfirm, newMessages, pendingReviews, unverifiedPrices, newApplications }, popular, workload });
  }

  if (user.permissions.includes("reports.view")) {
    const [todaySales, monthSales, rangeSales, outstanding, series] = await Promise.all([
      salesSummary(todayRange),
      salesSummary(monthRange),
      salesSummary(range),
      outstandingBalance(),
      dailySeries(range),
    ]);
    Object.assign(result, { sales: { today: todaySales, month: monthSales, range: rangeSales, outstanding, series } });
  }

  if (settings.features?.inventory && user.permissions.includes("inventory.manage")) {
    result.lowStock = (await lowStock()).map((p) => ({ id: String(p._id), name: p.name, quantity: p.quantity, unit: p.unit, threshold: p.lowStockThreshold }));
  }
  return json(result);
});
