import { Appointment, Invoice, Payment, Product, User } from "@/server/models";
import { TIMEZONE, addDaysToKey, dateKeyIST } from "@/lib/time";

// All figures come from stored records. Definitions:
//   Gross sales   = sum of invoice line totals before discounts (subtotal)
//   Discounts     = coupon + manual + loyalty discounts on those invoices
//   Tax           = tax charged (or included) on those invoices
//   Billed        = invoice totals (what customers were asked to pay)
//   Refunds       = refunds issued in the period
//   Net sales     = Billed − Refunds
//   Collected     = payments received in the period − refunds paid out in the period
// Void invoices are excluded everywhere. Unpaid balances are never counted as collected.

export interface Range {
  from: Date;
  to: Date;
}

export async function salesSummary({ from, to }: Range) {
  const [inv] = await Invoice.aggregate([
    { $match: { issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        gross: { $sum: "$subtotal" },
        discounts: { $sum: "$discountTotal" },
        tax: { $sum: "$tax.amount" },
        billed: { $sum: "$total" },
      },
    },
  ]);
  const payments = await Payment.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: { kind: "$kind", method: "$method" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const byMethod: Record<string, { collected: number; refunded: number; count: number }> = {};
  let received = 0;
  let refunds = 0;
  for (const p of payments) {
    const m = (byMethod[p._id.method] ??= { collected: 0, refunded: 0, count: 0 });
    if (p._id.kind === "payment") {
      m.collected += p.amount;
      m.count += p.count;
      received += p.amount;
    } else {
      m.refunded += p.amount;
      refunds += p.amount;
    }
  }
  const billed = inv?.billed ?? 0;
  return {
    invoices: inv?.count ?? 0,
    gross: inv?.gross ?? 0,
    discounts: inv?.discounts ?? 0,
    tax: inv?.tax ?? 0,
    billed,
    refunds,
    net: billed - refunds,
    received,
    collected: received - refunds,
    byMethod,
  };
}

export async function outstandingBalance() {
  const [row] = await Invoice.aggregate([
    { $match: { status: { $in: ["unpaid", "partially_paid"] } } },
    { $group: { _id: null, amount: { $sum: "$balanceDue" }, count: { $sum: 1 } } },
  ]);
  return { amount: row?.amount ?? 0, count: row?.count ?? 0 };
}

export async function appointmentStats({ from, to }: Range, staffId?: unknown) {
  const match: Record<string, unknown> = { start: { $gte: from, $lt: to } };
  if (staffId) match.staffId = staffId;
  const rows = await Appointment.aggregate([{ $match: match }, { $group: { _id: { status: "$status", source: "$source" }, count: { $sum: 1 } } }]);
  const byStatus: Record<string, number> = {};
  let walkIns = 0;
  let total = 0;
  for (const r of rows) {
    byStatus[r._id.status] = (byStatus[r._id.status] ?? 0) + r.count;
    if (r._id.source === "walk_in") walkIns += r.count;
    total += r.count;
  }
  const completed = byStatus.completed ?? 0;
  const cancelled = byStatus.cancelled ?? 0;
  const noShow = byStatus.no_show ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total,
    byStatus,
    walkIns,
    completionRate: pct(completed),
    cancellationRate: pct(cancelled),
    noShowRate: pct(noShow),
  };
}

export async function salesByService({ from, to }: Range, limit = 20) {
  return Invoice.aggregate([
    { $match: { issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" } } },
    { $unwind: "$lines" },
    { $match: { "lines.kind": "service" } },
    { $group: { _id: "$lines.description", amount: { $sum: "$lines.amount" }, count: { $sum: "$lines.qty" } } },
    { $sort: { amount: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: "$_id", amount: 1, count: 1 } },
  ]);
}

/**
 * Most popular services in the period: services on bills (including walk-ins billed without an
 * appointment) plus booked appointments that haven't been billed yet, so nothing is counted twice.
 */
export async function popularServices({ from, to }: Range, limit = 8) {
  const [billed, booked] = await Promise.all([
    Invoice.aggregate<{ _id: string; count: number }>([
      { $match: { issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" } } },
      { $unwind: "$lines" },
      { $match: { "lines.kind": "service" } },
      { $group: { _id: "$lines.description", count: { $sum: "$lines.qty" } } },
    ]),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { start: { $gte: from, $lt: to }, status: { $nin: ["cancelled", "no_show"] }, invoiceId: { $exists: false } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map<string, number>();
  for (const r of [...billed, ...booked]) counts.set(r._id, (counts.get(r._id) ?? 0) + r.count);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Bills made without an appointment (walk-in customers billed directly at the counter). */
export async function walkInBills({ from, to }: Range) {
  return Invoice.countDocuments({ issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" }, appointmentId: { $exists: false } });
}

export async function staffWorkload({ from, to }: Range) {
  const rows = await Appointment.aggregate([
    { $match: { start: { $gte: from, $lt: to }, status: { $nin: ["cancelled"] } } },
    {
      $group: {
        _id: "$staffId",
        appointments: { $sum: 1 },
        minutes: { $sum: "$durationMin" },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
      },
    },
    { $sort: { appointments: -1 } },
  ]);
  const names = new Map((await User.find({ _id: { $in: rows.map((r) => r._id) } }).select("name").lean()).map((u) => [String(u._id), u.name]));
  return rows.map((r) => ({ staffId: String(r._id), name: names.get(String(r._id)) ?? "Unknown", appointments: r.appointments, minutes: r.minutes, completed: r.completed }));
}

export async function dailySeries({ from, to }: Range) {
  const [billed, collected] = await Promise.all([
    Invoice.aggregate([
      { $match: { issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$issuedAt", timezone: TIMEZONE } }, amount: { $sum: "$total" } } },
    ]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
          amount: { $sum: { $cond: [{ $eq: ["$kind", "refund"] }, { $multiply: ["$amount", -1] }, "$amount"] } },
        },
      },
    ]),
  ]);
  const map = new Map<string, { date: string; billed: number; collected: number }>();
  for (const b of billed) map.set(b._id, { date: b._id, billed: b.amount, collected: 0 });
  for (const c of collected) {
    const row = map.get(c._id) ?? { date: c._id, billed: 0, collected: 0 };
    row.collected = c.amount;
    map.set(c._id, row);
  }
  // Include every day in the range (zero when nothing happened) so charts read as a timeline.
  const out: { date: string; billed: number; collected: number }[] = [];
  const last = dateKeyIST(new Date(to.getTime() - 1));
  for (let d = dateKeyIST(from); d <= last && out.length < 800; d = addDaysToKey(d, 1)) out.push(map.get(d) ?? { date: d, billed: 0, collected: 0 });
  return out;
}

export async function customerMix({ from, to }: Range) {
  const visitors: { _id: unknown }[] = await Appointment.aggregate([
    { $match: { start: { $gte: from, $lt: to }, status: "completed" } },
    { $group: { _id: "$customerId" } },
  ]);
  const ids = visitors.map((v) => v._id);
  const newCustomers = await User.countDocuments({ _id: { $in: ids }, firstVisitAt: { $gte: from, $lt: to } });
  return { total: ids.length, new: newCustomers, returning: ids.length - newCustomers };
}

export async function lowStock(limit = 20) {
  return Product.find({ active: true, $expr: { $lte: ["$quantity", "$lowStockThreshold"] }, lowStockThreshold: { $gt: 0 } })
    .select("name quantity unit lowStockThreshold")
    .sort({ quantity: 1 })
    .limit(limit)
    .lean();
}
