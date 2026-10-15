/**
 * DEVELOPMENT ONLY: creates demo logins for every role so you can try each dashboard.
 *
 *   npm run seed:demo
 *
 * Refuses to run when NODE_ENV=production. Never run this against the live database —
 * the passwords below are public. Existing accounts are left untouched, and if a real
 * owner already exists no demo owner is created.
 */
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

export const DEMO_USERS = [
  { role: "owner", name: "Varshika Rajput (Demo)", email: "owner@demo.vg", password: "Owner@1234", title: "Owner & Stylist", bookable: true },
  { role: "receptionist", name: "Riya Front Desk (Demo)", email: "reception@demo.vg", password: "Reception@1234", title: "Receptionist", bookable: false },
  { role: "stylist", name: "Arjun Stylist (Demo)", email: "stylist@demo.vg", password: "Stylist@1234", title: "Senior Stylist", bookable: true },
  { role: "stylist", name: "Neha Stylist (Demo)", email: "stylist2@demo.vg", password: "Stylist@1234", title: "Beauty Specialist", bookable: true },
  { role: "customer", name: "Aman Customer (Demo)", email: "customer@demo.vg", password: "Customer@1234", phone: "9876500001" },
  { role: "customer", name: "Pooja Customer (Demo)", email: "customer2@demo.vg", password: "Customer@1234", phone: "9876500002" },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("seed:demo is for development only and will not run with NODE_ENV=production.");
    process.exit(1);
  }
  const { connectDB, disconnectDB } = await import("../src/server/db");
  const { User } = await import("../src/server/models");
  const { hashPassword } = await import("../src/server/auth/password");
  await connectDB();

  const rows: string[][] = [];
  for (const u of DEMO_USERS) {
    if (u.role === "owner") {
      const owner = await User.findOne({ role: "owner" }).lean();
      if (owner && owner.email !== u.email) {
        rows.push(["owner", owner.email ?? "", "(your existing owner — unchanged)"]);
        continue;
      }
    }
    const existing = await User.findOne({ email: u.email, isGuest: false });
    if (existing) {
      rows.push([u.role, u.email, `${u.password}  (already existed)`]);
      continue;
    }
    await User.create({
      name: u.name,
      email: u.email,
      phone: "phone" in u ? u.phone : undefined,
      role: u.role,
      passwordHash: await hashPassword(u.password),
      ...("title" in u ? { staff: { title: u.title, bookable: u.bookable } } : {}),
    });
    rows.push([u.role, u.email, u.password]);
  }

  console.log("\nDemo logins (sign in at /login):\n");
  console.log(["Role", "Email", "Password"].map((h, i) => h.padEnd([14, 22, 0][i])).join(""));
  for (const r of rows) console.log(r[0].padEnd(14) + r[1].padEnd(22) + r[2]);
  console.log("\nStaff go to /dashboard, customers to /account. Delete these accounts before going live.");
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
