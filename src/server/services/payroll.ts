import { Types } from "mongoose";
import { Invoice, PayEntry, PayProfile, User, type PayEntryType, type PayProfileDoc } from "@/server/models";
import { addDaysToKey, istToUtc } from "@/lib/time";

// Monthly pay statement per employee (all amounts in paise):
//   earned  = monthly salary + commission + bonuses
//   balance = earned − deductions − advances − salary already paid
// Commission = commission % × the employee's service sales in the month, net of bill discounts.
// Sales are taken from bills (non-void) whose stylist is set on the bill or on its appointment.

export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: istToUtc(`${month}-01`, 0), to: istToUtc(`${next}-01`, 0), lastDay: addDaysToKey(`${next}-01`, -1) };
}

/** Service sales (net of each bill's discount share) per staff member for the month. */
async function serviceSalesByStaff(month: string) {
  const { from, to } = monthRange(month);
  const rows = await Invoice.aggregate<{ _id: Types.ObjectId; sales: number; bills: number }>([
    { $match: { issuedAt: { $gte: from, $lt: to }, status: { $ne: "void" } } },
    { $lookup: { from: "appointments", localField: "appointmentId", foreignField: "_id", as: "appt", pipeline: [{ $project: { staffId: 1 } }] } },
    { $addFields: { staff: { $ifNull: ["$staffId", { $first: "$appt.staffId" }] } } },
    { $match: { staff: { $ne: null } } },
    {
      $addFields: {
        // Share of the bill left after discounts, applied to each service line.
        netFactor: { $cond: [{ $gt: ["$subtotal", 0] }, { $divide: [{ $max: [{ $subtract: ["$subtotal", "$discountTotal"] }, 0] }, "$subtotal"] }, 0] },
      },
    },
    { $unwind: "$lines" },
    { $match: { "lines.kind": "service" } },
    { $group: { _id: "$staff", sales: { $sum: { $multiply: ["$lines.amount", "$netFactor"] } }, billIds: { $addToSet: "$_id" } } },
    { $project: { sales: { $round: ["$sales", 0] }, bills: { $size: "$billIds" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

async function entryTotals(month: string, userId?: Types.ObjectId) {
  const rows = await PayEntry.aggregate<{ _id: { user: Types.ObjectId; type: PayEntryType }; amount: number }>([
    { $match: { month, ...(userId ? { userId } : {}) } },
    { $group: { _id: { user: "$userId", type: "$type" }, amount: { $sum: "$amount" } } },
  ]);
  const map = new Map<string, Record<PayEntryType, number>>();
  for (const r of rows) {
    const t = map.get(String(r._id.user)) ?? { payment: 0, advance: 0, bonus: 0, deduction: 0 };
    t[r._id.type] = r.amount;
    map.set(String(r._id.user), t);
  }
  return map;
}

export function serialiseProfile(p: PayProfileDoc | null) {
  return {
    monthlySalary: p?.monthlySalary ?? 0,
    commissionPercent: p?.commissionPercent ?? 0,
    joinedOn: p?.joinedOn ?? "",
    paymentDetails: p?.paymentDetails ?? "",
    notes: p?.notes ?? "",
  };
}

/** Pay statement for every employee for the month (or one employee when userId is given). */
export async function payrollStatement(month: string, userId?: Types.ObjectId) {
  const { lastDay } = monthRange(month);
  const [staff, profiles, totals, sales] = await Promise.all([
    User.find({ role: { $in: ["owner", "receptionist", "stylist"] }, ...(userId ? { _id: userId } : {}) })
      .select("name role active staff.title")
      .sort({ role: 1, name: 1 })
      .lean(),
    PayProfile.find(userId ? { userId } : {}).lean<PayProfileDoc[]>(),
    entryTotals(month, userId),
    serviceSalesByStaff(month),
  ]);
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  return staff
    .map((s) => {
      const id = String(s._id);
      const profile = profileMap.get(id) ?? null;
      const t = totals.get(id) ?? { payment: 0, advance: 0, bonus: 0, deduction: 0 };
      // No salary for months before the employee joined.
      const salary = profile?.joinedOn && profile.joinedOn > lastDay ? 0 : (profile?.monthlySalary ?? 0);
      const serviceSales = sales.get(id)?.sales ?? 0;
      const commission = Math.round((serviceSales * (profile?.commissionPercent ?? 0)) / 100);
      const earned = salary + commission + t.bonus;
      return {
        id,
        name: s.name,
        role: s.role,
        title: s.staff?.title ?? "",
        active: s.active !== false,
        profile: serialiseProfile(profile),
        salary,
        serviceSales,
        bills: sales.get(id)?.bills ?? 0,
        commission,
        bonus: t.bonus,
        deduction: t.deduction,
        advance: t.advance,
        paid: t.payment,
        earned,
        balance: earned - t.deduction - t.advance - t.payment,
      };
    })
    .filter((r) => {
      // The owner and former staff only appear when they have pay set up or records this month.
      const hasPay = r.profile.monthlySalary > 0 || r.profile.commissionPercent > 0;
      const hasRecords = r.bonus || r.deduction || r.advance || r.paid;
      if (r.role === "owner") return hasPay || !!hasRecords;
      return r.active || !!hasRecords;
    });
}

export type PayrollRow = Awaited<ReturnType<typeof payrollStatement>>[number];
