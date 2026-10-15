import { api, json } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { parseRange } from "@/server/services/report-range";
import {
  appointmentStats,
  customerMix,
  dailySeries,
  lowStock,
  outstandingBalance,
  salesByService,
  salesSummary,
  staffWorkload,
} from "@/server/services/reports";
import { InventoryMovement, Invoice } from "@/server/models";
import { getSettings } from "@/server/services/settings";

export const GET = api(async (req) => {
  await requirePermission("reports.view");
  const { from, to, range } = parseRange(req.nextUrl.searchParams);
  const settings = await getSettings();
  const [sales, appointments, services, workload, customers, series, outstanding, discounts] = await Promise.all([
    salesSummary(range),
    appointmentStats(range),
    salesByService(range),
    staffWorkload(range),
    customerMix(range),
    dailySeries(range),
    outstandingBalance(),
    Invoice.aggregate([
      { $match: { issuedAt: { $gte: range.from, $lt: range.to }, status: { $ne: "void" } } },
      { $unwind: "$discounts" },
      { $group: { _id: "$discounts.kind", amount: { $sum: "$discounts.amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  let inventory = null;
  if (settings.features?.inventory) {
    const usage = await InventoryMovement.aggregate([
      { $match: { createdAt: { $gte: range.from, $lt: range.to }, type: { $in: ["consumed", "sold"] } } },
      { $group: { _id: { productId: "$productId", type: "$type" }, qty: { $sum: "$qty" } } },
      { $lookup: { from: "products", localField: "_id.productId", foreignField: "_id", as: "p" } },
      { $project: { _id: 0, name: { $first: "$p.name" }, unit: { $first: "$p.unit" }, type: "$_id.type", qty: { $abs: "$qty" } } },
      { $sort: { qty: -1 } },
      { $limit: 30 },
    ]);
    inventory = { usage, lowStock: (await lowStock(50)).map((p) => ({ name: p.name, quantity: p.quantity, unit: p.unit, threshold: p.lowStockThreshold })) };
  }
  return json({
    range: { from, to },
    sales,
    appointments,
    services,
    workload,
    customers,
    series,
    outstanding,
    discounts: discounts.map((d) => ({ kind: d._id, amount: d.amount, count: d.count })),
    inventory,
  });
});
