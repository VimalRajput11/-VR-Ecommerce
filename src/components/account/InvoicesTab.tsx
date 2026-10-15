"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { EmptyState, ErrorState, Spinner, StatusBadge, buttonClass } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

interface Inv {
  id: string;
  number: string;
  issuedAt: string;
  total: number;
  balanceDue: number;
  status: string;
}

export default function InvoicesTab() {
  const { data, error, loading, reload } = useApi<{ invoices: Inv[]; onlinePayments: boolean }>("/api/account/invoices");
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.invoices.length) return <EmptyState title="No invoices yet">Invoices appear here after your visit is billed at the salon.</EmptyState>;
  return (
    <ul className="divide-y divide-beige rounded-lg border border-beige bg-white">
      {data.invoices.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-mono text-sm font-semibold">{i.number}</p>
            <p className="text-xs text-stone">{formatDate(i.issuedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-medium">{formatINR(i.total)}</p>
              {i.balanceDue > 0 && <p className="text-xs text-danger">{formatINR(i.balanceDue)} due</p>}
            </div>
            <StatusBadge status={i.status} />
            <Link href={`/account/invoices/${i.id}`} className={buttonClass(i.balanceDue > 0 && data.onlinePayments ? "primary" : "secondary", "sm")}>
              {i.balanceDue > 0 && data.onlinePayments ? "View & pay" : "View"}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
