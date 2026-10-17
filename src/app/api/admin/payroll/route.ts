import { api, json } from "@/server/lib/http";
import { badRequest } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { isMonthKey, payrollStatement } from "@/server/services/payroll";
import { dateKeyIST } from "@/lib/time";

/** Owner only: pay statement for all employees for ?month=YYYY-MM (default: this month). */
export const GET = api(async (req) => {
  await requirePermission("payroll.manage");
  const month = req.nextUrl.searchParams.get("month") || dateKeyIST().slice(0, 7);
  if (!isMonthKey(month)) throw badRequest("Choose a valid month.", "month");
  const rows = await payrollStatement(month);
  const sum = (k: "salary" | "commission" | "bonus" | "deduction" | "advance" | "paid" | "balance") => rows.reduce((s, r) => s + r[k], 0);
  return json({
    month,
    rows,
    totals: { salary: sum("salary"), commission: sum("commission"), bonus: sum("bonus"), deduction: sum("deduction"), advance: sum("advance"), paid: sum("paid"), balance: sum("balance") },
  });
});
