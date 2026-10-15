"use client";

import { useState } from "react";
import Link from "next/link";
import { qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Spinner, StatusBadge, Table, Td, Th, buttonClass } from "@/components/ui";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import type { InvoiceData } from "@/components/billing/InvoiceView";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default function BillingPage() {
  return (
    <RequirePermission any={["billing.manage", "reports.view"]}>
      <Billing />
    </RequirePermission>
  );
}

function Billing() {
  const { can } = useAuth();
  const [filters, setFiltersRaw] = useState({ q: "", status: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const setFilters = (f: typeof filters) => {
    setFiltersRaw(f);
    setPage(1);
  };
  const { data, error, loading, reload } = useApi<{ items: InvoiceData[]; total: number; page: number; limit: number }>(`/api/admin/invoices${qs({ ...filters, page })}`);
  return (
    <div>
      <PageHeader
        title="Billing"
        description="Invoices, payments and receipts."
        actions={
          can("billing.manage") && (
            <Link href="/dashboard/billing/new" className={buttonClass("primary")}>
              New bill
            </Link>
          )
        }
      />
      <div className="mb-4 grid gap-3 rounded-lg border border-beige bg-white p-4 sm:grid-cols-4">
        <Input label="Search" placeholder="Invoice no., name, phone" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Any</option>
          <option value="outstanding">Outstanding</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No invoices">Bills you create appear here.</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id} className="hover:bg-cream/50">
                  <Td>
                    <Link href={`/dashboard/billing/${i.id}`} className="font-mono font-medium hover:underline">
                      {i.number}
                    </Link>
                  </Td>
                  <Td>{formatDate(i.issuedAt)}</Td>
                  <Td>{i.customer.name}</Td>
                  <Td className="text-right">{formatINR(i.total)}</Td>
                  <Td className="text-right">{formatINR(i.amountPaid - i.amountRefunded)}</Td>
                  <Td className={`text-right ${i.balanceDue ? "text-danger" : ""}`}>{formatINR(i.balanceDue)}</Td>
                  <Td>
                    <StatusBadge status={i.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
    </div>
  );
}
