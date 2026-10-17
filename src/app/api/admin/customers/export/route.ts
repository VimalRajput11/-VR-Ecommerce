import { api, csvResponse } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { Invoice, User } from "@/server/models";
import { formatDate } from "@/lib/time";
import { audit } from "@/server/services/audit";

/** Owner-only export. Marketing consent is included so it can be respected downstream. */
export const GET = api(async () => {
  const user = await requirePermission("customers.export");
  const customers = await User.find({ role: "customer" }).sort({ name: 1 }).limit(20_000).lean();
  // Visit dates include bills, since walk-ins are often billed without an appointment.
  const bills = await Invoice.aggregate<{ _id: unknown; first: Date; last: Date }>([
    { $match: { status: { $ne: "void" } } },
    { $group: { _id: "$customerId", first: { $min: "$issuedAt" }, last: { $max: "$issuedAt" } } },
  ]);
  const billMap = new Map(bills.map((b) => [String(b._id), b]));
  const visit = (c: (typeof customers)[number], which: "first" | "last") => {
    const dates = [which === "first" ? c.firstVisitAt : c.lastVisitAt, billMap.get(String(c._id))?.[which]].filter((d): d is Date => !!d).map((d) => d.getTime());
    if (!dates.length) return "";
    return formatDate(which === "first" ? Math.min(...dates) : Math.max(...dates));
  };
  await audit(user, "customer.export", "User", undefined, `Exported ${customers.length} customers`);
  return csvResponse(`vg-customers-${Date.now()}.csv`, [
    ["Name", "Phone", "Email", "Account", "Marketing consent", "First visit", "Last visit", "Loyalty points"],
    ...customers.map((c) => [
      c.name,
      c.phone ?? "",
      c.email ?? "",
      c.isGuest ? "Guest" : "Registered",
      c.marketingConsent ? "Yes" : "No",
      visit(c, "first"),
      visit(c, "last"),
      c.loyaltyPoints ?? 0,
    ]),
  ]);
});
