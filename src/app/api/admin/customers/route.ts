import { api, json, readJson } from "@/server/lib/http";
import { escapeRegex, optEmail, optStr, pagination, phone, str } from "@/server/lib/validate";
import { conflict } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { Invoice, User } from "@/server/models";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  await requirePermission("customers.view");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = { role: "customer" };
  const q = p.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const { page, limit, skip } = pagination(p, 25);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ lastVisitAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const spend = await Invoice.aggregate([
    { $match: { customerId: { $in: items.map((i) => i._id) }, status: { $ne: "void" } } },
    {
      $group: {
        _id: "$customerId",
        paid: { $sum: { $subtract: ["$amountPaid", "$amountRefunded"] } },
        due: { $sum: "$balanceDue" },
        lastBill: { $max: "$issuedAt" },
      },
    },
  ]);
  const spendMap = new Map(spend.map((s) => [String(s._id), s]));
  // Last visit = latest completed appointment or bill (walk-ins are often billed without an appointment).
  const lastVisit = (c: { _id: unknown; lastVisitAt?: Date | null }) => {
    const bill: Date | undefined = spendMap.get(String(c._id))?.lastBill;
    return c.lastVisitAt && (!bill || c.lastVisitAt > bill) ? c.lastVisitAt : (bill ?? null);
  };
  return json({
    items: items.map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      isGuest: !!c.isGuest,
      lastVisitAt: lastVisit(c),
      totalPaid: spendMap.get(String(c._id))?.paid ?? 0,
      balanceDue: spendMap.get(String(c._id))?.due ?? 0,
    })),
    total,
    page,
    limit,
  });
});

/** Front-desk customer creation (stored as a guest profile until the customer registers). */
export const POST = api(async (req) => {
  const user = await requirePermission("customers.manage", "appointments.manage");
  const body = await readJson(req);
  const ph = phone(body);
  if (await User.exists({ phone: ph, isGuest: true })) throw conflict("A customer with this phone number already exists.");
  const customer = await User.create({
    name: str(body, "name", { max: 100, label: "Name" }),
    phone: ph,
    email: optEmail(body),
    preferences: optStr(body, "preferences", { max: 1000 }),
    role: "customer",
    isGuest: true,
  });
  await audit(user, "customer.create", "User", String(customer._id), `Added customer ${customer.name}`);
  return json({ customer: { id: String(customer._id), name: customer.name, phone: customer.phone } }, 201);
});
