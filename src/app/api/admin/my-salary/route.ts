import { Types } from "mongoose";
import { api, json } from "@/server/lib/http";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { PayEntry } from "@/server/models";
import { isMonthKey, payrollStatement } from "@/server/services/payroll";
import { dateKeyIST } from "@/lib/time";

/**
 * A staff member's own salary for ?month=YYYY-MM: statement plus all their pay records.
 * Always scoped to the signed-in user; the owner's private notes and payment details are left out.
 */
export const GET = api(async (req) => {
  const user = await requirePermission("payroll.own");
  const month = req.nextUrl.searchParams.get("month") || dateKeyIST().slice(0, 7);
  if (!isMonthKey(month)) throw badRequest("Choose a valid month.", "month");
  const userId = new Types.ObjectId(user.id);
  const [[row], entries] = await Promise.all([
    payrollStatement(month, userId),
    PayEntry.find({ userId }).sort({ month: -1, date: -1, createdAt: -1 }).limit(500).lean(),
  ]);
  return json({
    month,
    statement: row
      ? {
          monthlySalary: row.profile.monthlySalary,
          commissionPercent: row.profile.commissionPercent,
          salary: row.salary,
          serviceSales: row.serviceSales,
          bills: row.bills,
          commission: row.commission,
          bonus: row.bonus,
          deduction: row.deduction,
          advance: row.advance,
          paid: row.paid,
          earned: row.earned,
          balance: row.balance,
        }
      : null,
    entries: entries.map((e) => ({ id: String(e._id), month: e.month, type: e.type, amount: e.amount, date: e.date, method: e.method, note: e.note ?? "" })),
  });
});
