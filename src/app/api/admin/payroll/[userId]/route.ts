import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, dateKey, int, objectId } from "@/server/lib/validate";
import { badRequest, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { PayEntry, PayProfile, User, type PayProfileDoc } from "@/server/models";
import { isMonthKey, payrollStatement, serialiseProfile } from "@/server/services/payroll";
import { audit } from "@/server/services/audit";
import { formatINR } from "@/lib/money";
import { dateKeyIST } from "@/lib/time";

type Ctx = { params: Promise<{ userId: string }> };

async function loadStaff(id: ReturnType<typeof objectId>) {
  const staff = await User.findOne({ _id: id, role: { $in: ["owner", "receptionist", "stylist"] } }).select("name role").lean();
  if (!staff) throw notFound("Staff member not found.");
  return staff;
}

/** One employee: pay terms, this month's statement and records, and their full history. */
export const GET = api<Ctx>(async (req, ctx) => {
  await requirePermission("payroll.manage");
  const id = objectId((await ctx.params).userId);
  const staff = await loadStaff(id);
  const month = req.nextUrl.searchParams.get("month") || dateKeyIST().slice(0, 7);
  if (!isMonthKey(month)) throw badRequest("Choose a valid month.", "month");
  const [profile, [statement], entries] = await Promise.all([
    PayProfile.findOne({ userId: id }).lean<PayProfileDoc>(),
    payrollStatement(month, id),
    PayEntry.find({ userId: id }).sort({ month: -1, date: -1, createdAt: -1 }).limit(500).lean(),
  ]);
  return json({
    staff: { id: String(staff._id), name: staff.name, role: staff.role },
    month,
    profile: serialiseProfile(profile),
    statement: statement ?? null,
    entries: entries.map((e) => ({ id: String(e._id), month: e.month, type: e.type, amount: e.amount, date: e.date, method: e.method, note: e.note ?? "" })),
  });
});

/** Update pay terms (salary, commission %, joining date, payment details, notes). */
export const PUT = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("payroll.manage");
  const id = objectId((await ctx.params).userId);
  const staff = await loadStaff(id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {
    monthlySalary: int(body, "monthlySalary", { min: 0, max: 100_000_000, label: "Monthly salary" }),
    commissionPercent: int(body, "commissionPercent", { min: 0, max: 100, label: "Commission %" }),
  };
  if (body.joinedOn) set.joinedOn = dateKey(body.joinedOn, "joinedOn");
  else set.joinedOn = "";
  const details = clearableStr(body, "paymentDetails", { max: 300 });
  if (details !== undefined) set.paymentDetails = details;
  const notes = clearableStr(body, "notes", { max: 1000 });
  if (notes !== undefined) set.notes = notes;
  await PayProfile.updateOne({ userId: id }, { $set: set }, { upsert: true, runValidators: true });
  await audit(user, "payroll.profile", "User", String(id), `Pay terms for ${staff.name}: ${formatINR(set.monthlySalary as number)}/month, ${set.commissionPercent}% commission`);
  return json({ ok: true });
});
