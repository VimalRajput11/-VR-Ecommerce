"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ConciergeBell,
  Users,
  Receipt,
  Scissors,
  UserCog,
  Tag,
  Package,
  Star,
  Images,
  MessageSquare,
  BarChart3,
  Settings,
  History,
  Clock,
  Briefcase,
  Menu,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Permission } from "@/lib/permissions";
import { cx } from "@/components/ui";

export interface Features {
  inventory: boolean;
  reviews: boolean;
  loyalty: boolean;
  retail: boolean;
}

const FeatureContext = createContext<Features>({ inventory: false, reviews: true, loyalty: false, retail: false });
export const useFeatures = () => useContext(FeatureContext);

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  any: Permission[];
  feature?: keyof Features;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, any: ["dashboard.view"] },
  { href: "/dashboard/front-desk", label: "Front desk", icon: ConciergeBell, any: ["appointments.manage"] },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays, any: ["appointments.view_all", "appointments.view_own"] },
  { href: "/dashboard/customers", label: "Customers", icon: Users, any: ["customers.view"] },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt, any: ["billing.manage", "reports.view"] },
  { href: "/dashboard/services", label: "Services", icon: Scissors, any: ["services.manage"] },
  { href: "/dashboard/staff", label: "Staff & hours", icon: UserCog, any: ["staff.manage"] },
  { href: "/dashboard/availability", label: "My availability", icon: Clock, any: ["availability.own"] },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, any: ["offers.manage"] },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package, any: ["inventory.manage"], feature: "inventory" },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star, any: ["reviews.moderate"] },
  { href: "/dashboard/gallery", label: "Gallery", icon: Images, any: ["gallery.manage"] },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, any: ["messages.view"] },
  { href: "/dashboard/careers", label: "Careers", icon: Briefcase, any: ["careers.manage"] },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, any: ["reports.view"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, any: ["settings.manage"] },
  { href: "/dashboard/activity", label: "Activity log", icon: History, any: ["audit.view"] },
];

export default function DashboardShell({ children, businessName, features }: { children: ReactNode; businessName: string; features: Features }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const items = NAV.filter((n) => (!n.feature || features[n.feature]) && n.any.some((p) => user?.permissions.includes(p))).filter(
    // The owner manages everyone's hours from Staff; "My availability" is for staff.
    (n) => !(n.href === "/dashboard/availability" && user?.permissions.includes("staff.manage")),
  );

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-gold/15 text-gold" : "text-ivory/75 hover:bg-ivory/5 hover:text-ivory")}
          >
            <Icon size={17} aria-hidden /> {n.href === "/dashboard/appointments" && !user?.permissions.includes("appointments.view_all") ? "My schedule" : n.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto space-y-1 border-t border-ivory/10 pt-4 text-sm">
      <p className="px-3 text-ivory">{user?.name}</p>
      <p className="px-3 pb-2 text-xs capitalize text-mist">{user?.role}</p>
      <Link href="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-ivory/75 hover:bg-ivory/5">
        <ExternalLink size={16} aria-hidden /> View website
      </Link>
      <Link href="/account?tab=profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-ivory/75 hover:bg-ivory/5">
        <UserCog size={16} aria-hidden /> My profile &amp; password
      </Link>
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.replace("/login");
          router.refresh();
        }}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-ivory/75 hover:bg-ivory/5"
      >
        <LogOut size={16} aria-hidden /> Sign out
      </button>
    </div>
  );

  return (
    <FeatureContext.Provider value={features}>
      <div className="flex min-h-screen bg-cream/50">
        <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-charcoal px-3 py-5 lg:flex">
          <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
            <Image src="/logo.png" alt="" width={36} height={36} />
            <span className="font-serif text-ivory">{businessName}</span>
          </Link>
          {nav}
          {footer}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-charcoal px-4 lg:hidden">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="" width={30} height={30} />
              <span className="font-serif text-sm text-ivory">{businessName}</span>
            </Link>
            <button type="button" onClick={() => setOpen(true)} className="rounded p-2 text-ivory" aria-label="Open menu" aria-expanded={open}>
              <Menu size={22} />
            </button>
          </header>
          {open && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-charcoal px-3 py-5">
                <div className="mb-5 flex items-center justify-between px-2">
                  <span className="font-serif text-ivory">{businessName}</span>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-ivory">
                    <X size={22} />
                  </button>
                </div>
                {nav}
                {footer}
              </div>
              <button type="button" aria-label="Close menu" className="flex-1 bg-charcoal/50" onClick={() => setOpen(false)} />
            </div>
          )}
          <main className="w-full flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </FeatureContext.Provider>
  );
}

/** Client-side guard for hiding a page a user cannot use (the API enforces access regardless). */
export function RequirePermission({ any, children }: { any: Permission[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!any.some((p) => user?.permissions.includes(p))) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-serif text-2xl">No access</p>
        <p className="mt-2 text-sm text-stone">Your account doesn&apos;t have permission to view this page. Please ask the owner if you need access.</p>
      </div>
    );
  }
  return <>{children}</>;
}
