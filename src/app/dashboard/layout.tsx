import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | VG Dashboard" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user;
  let settings;
  try {
    user = await getSessionUser();
    settings = user ? await getSettings() : null;
  } catch {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-serif text-2xl">Dashboard unavailable</h1>
        <p className="mt-2 text-stone">The database could not be reached. Please check the server and try again.</p>
      </div>
    );
  }
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "customer") redirect("/account");
  return (
    <DashboardShell
      businessName={settings?.name ?? "VG Unisex Salon"}
      features={{
        inventory: !!settings?.features?.inventory,
        reviews: !!settings?.features?.reviews,
        loyalty: !!settings?.features?.loyalty,
        retail: !!settings?.features?.retail,
      }}
    >
      {children}
    </DashboardShell>
  );
}
