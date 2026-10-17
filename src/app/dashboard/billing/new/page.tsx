"use client";

import { Suspense } from "react";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Spinner } from "@/components/ui";
import BillingPOS from "@/components/pos/BillingPOS";

/** Billing point of sale: build a bill, save it, or finalize it with payments. */
export default function NewBillPage() {
  return (
    <RequirePermission any={["billing.manage"]}>
      <Suspense fallback={<Spinner />}>
        <BillingPOS />
      </Suspense>
    </RequirePermission>
  );
}
