import { api, json, readJson } from "@/server/lib/http";
import { dateKey, int, objectId, oneOf, optStr } from "@/server/lib/validate";
import { badRequest, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { PAY_ENTRY_TYPES, PayEntry, User } from "@/server/models";
import { isMonthKey } from "@/server/services/payroll";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";

type Ctx = { params: Promise<{ userId: string }> };

const LABELS = { payment: "Salary paid", advance: "Advance", bonus: "Bonus", deduction: "Deduction" } as const;

/** Record a salary payment, advance, bonus or deduction for one employee. */
export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("payroll.manage");
  const id = objectId((await ctx.params).userId);
  const staff = await User.findOne({ _id: id, role: { $in: ["owner", "receptionist", "stylist"] } }).select("name").lean();
  if (!staff) throw notFound("Staff member not found.");
  const body = await readJson(req);
  const month = body.month;
  if (!isMonthKey(month)) throw badRequest("Choose the salary month.", "month");
  const entry = await PayEntry.create({
    userId: id,
    month,
    type: oneOf(body, "type", PAY_ENTRY_TYPES),
    amount: int(body, "amount", { min: 1, max: 100_000_000, label: "Amount" }),
    date: dateKey(body.date, "date"),
    method: oneOf(body, "method", ["cash", "upi", "bank", "other"] as const),
    note: optStr(body, "note", { max: 300 }) ?? "",
    recordedBy: user.id,
  });
  await audit(user, "payroll.entry", "PayEntry", String(entry._id), `${LABELS[entry.type]} ${formatINR(entry.amount)} for ${staff.name} (${month})`);
  return json({ ok: true }, 201);
});
