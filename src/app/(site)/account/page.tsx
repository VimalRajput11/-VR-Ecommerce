import { Suspense } from "react";
import CustomerPortal from "@/components/account/CustomerPortal";

export default function AccountPage() {
  return (
    <Suspense>
      <CustomerPortal />
    </Suspense>
  );
}
