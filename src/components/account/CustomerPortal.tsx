"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Tabs, buttonClass } from "@/components/ui";
import AppointmentsTab from "./AppointmentsTab";
import InvoicesTab from "./InvoicesTab";
import ProfileTab from "./ProfileTab";
import RewardsTab from "./RewardsTab";
import NotificationsTab from "./NotificationsTab";

type TabId = "appointments" | "invoices" | "rewards" | "notifications" | "profile";

export default function CustomerPortal() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // Staff (owner, receptionist, stylist) only manage their own profile here; the customer
  // tabs (appointments, invoices, rewards) live in the dashboard for them.
  const isStaff = !!user && user.role !== "customer";
  const initial = (params.get("tab") as TabId) || "appointments";
  const [tab, setTab] = useState<TabId>(initial);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-deep">{isStaff ? "My profile" : "My account"}</p>
          <h1 className="mt-1 font-serif text-3xl">Hello{user ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        </div>
        <div className="flex gap-2">
          {isStaff ? (
            <Link href="/dashboard" className={buttonClass("primary", "sm")}>
              Back to dashboard
            </Link>
          ) : (
            <Link href="/book" className={buttonClass("primary", "sm")}>
              Book an appointment
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/");
              router.refresh();
            }}
            className={buttonClass("ghost", "sm")}
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
      </div>
      {isStaff ? (
        <ProfileTab />
      ) : (
        <>
          <Tabs<TabId>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "appointments", label: "Appointments" },
              { id: "invoices", label: "Invoices" },
              { id: "rewards", label: "Rewards & offers" },
              { id: "notifications", label: "Notifications" },
              { id: "profile", label: "Profile" },
            ]}
          />
          {tab === "appointments" && <AppointmentsTab />}
          {tab === "invoices" && <InvoicesTab />}
          {tab === "rewards" && <RewardsTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "profile" && <ProfileTab />}
        </>
      )}
    </div>
  );
}
