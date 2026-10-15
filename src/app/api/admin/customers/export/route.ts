import { api, csvResponse } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { User } from "@/server/models";
import { formatDate } from "@/lib/time";
import { audit } from "@/server/services/audit";

/** Owner-only export. Marketing consent is included so it can be respected downstream. */
export const GET = api(async () => {
  const user = await requirePermission("customers.export");
  const customers = await User.find({ role: "customer" }).sort({ name: 1 }).limit(20_000).lean();
  await audit(user, "customer.export", "User", undefined, `Exported ${customers.length} customers`);
  return csvResponse(`vg-customers-${Date.now()}.csv`, [
    ["Name", "Phone", "Email", "Account", "Marketing consent", "First visit", "Last visit", "Loyalty points"],
    ...customers.map((c) => [
      c.name,
      c.phone ?? "",
      c.email ?? "",
      c.isGuest ? "Guest" : "Registered",
      c.marketingConsent ? "Yes" : "No",
      c.firstVisitAt ? formatDate(c.firstVisitAt) : "",
      c.lastVisitAt ? formatDate(c.lastVisitAt) : "",
      c.loyaltyPoints ?? 0,
    ]),
  ]);
});
