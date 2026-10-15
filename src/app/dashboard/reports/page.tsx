"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { qs, useApi } from "@/lib/api";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { ColumnChart, HBarList } from "@/components/dashboard/BarChart";
import { Button, Card, ErrorState, Input, PageHeader, Spinner, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { addDaysToKey, dateKeyIST, formatDateKey } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, STATUS_LABELS, type AppointmentStatus, type PaymentMethod } from "@/lib/constants";

interface Report {
  range: { from: string; to: string };
  sales: { invoices: number; gross: number; discounts: number; tax: number; billed: number; refunds: number; net: number; received: number; collected: number; byMethod: Record<string, { collected: number; refunded: number; count: number }> };
  appointments: { total: number; byStatus: Record<string, number>; walkIns: number; completionRate: number; cancellationRate: number; noShowRate: number };
  services: { name: string; amount: number; count: number }[];
  workload: { name: string; appointments: number; minutes: number; completed: number }[];
  customers: { total: number; new: number; returning: number };
  series: { date: string; billed: number; collected: number }[];
  outstanding: { amount: number; count: number };
  discounts: { kind: string; amount: number; count: number }[];
  inventory: null | { usage: { name: string; unit: string; type: string; qty: number }[]; lowStock: { name: string; quantity: number; unit: string; threshold: number }[] };
}

export default function ReportsPage() {
  return (
    <RequirePermission any={["reports.view"]}>
      <Reports />
    </RequirePermission>
  );
}

function Reports() {
  const today = dateKeyIST();
  const [range, setRange] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const { data, error, loading, reload } = useApi<Report>(`/api/admin/reports${qs(range)}`);
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDaysToKey(today, -6), to: today },
    { label: "This month", from: `${today.slice(0, 8)}01`, to: today },
    { label: "Last 90 days", from: addDaysToKey(today, -89), to: today },
  ];
  const exportUrl = (type: string) => `/api/admin/reports/export${qs({ type, ...range })}`;

  return (
    <div>
      <PageHeader title="Reports" description="All figures come from recorded invoices, payments and appointments." />
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-beige bg-white p-4">
        {presets.map((p) => (
          <Button key={p.label} size="sm" variant={range.from === p.from && range.to === p.to ? "primary" : "secondary"} onClick={() => setRange({ from: p.from, to: p.to })}>
            {p.label}
          </Button>
        ))}
        <Input label="From" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} wrapClassName="w-40" />
        <Input label="To" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} wrapClassName="w-40" />
        <div className="ml-auto flex flex-wrap gap-2">
          {["invoices", "payments", "appointments"].map((t) => (
            <a key={t} href={exportUrl(t)} className={buttonClass("ghost", "sm")}>
              <Download size={14} aria-hidden /> {t} CSV
            </a>
          ))}
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          <p className="text-sm text-stone">
            {formatDateKey(data.range.from)} – {formatDateKey(data.range.to)}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Gross sales" value={formatINR(data.sales.gross)} hint={`${data.sales.invoices} invoice${data.sales.invoices === 1 ? "" : "s"}`} />
            <Stat label="Discounts" value={`−${formatINR(data.sales.discounts)}`} />
            <Stat label="Refunds" value={`−${formatINR(data.sales.refunds)}`} />
            <Stat label="Net sales" value={formatINR(data.sales.net)} hint="Billed − refunds" />
            <Stat label="Tax" value={formatINR(data.sales.tax)} />
            <Stat label="Collected" value={formatINR(data.sales.collected)} hint="Payments − refunds" />
            <Stat label="Outstanding (all time)" value={formatINR(data.outstanding.amount)} hint={`${data.outstanding.count} invoices`} tone={data.outstanding.amount ? "warning" : "default"} />
            <Stat label="Customers served" value={data.customers.total} hint={`${data.customers.new} new · ${data.customers.returning} returning`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Billed per day">
              <ColumnChart title="Billed per day" data={data.series.map((d) => ({ label: formatDateKey(d.date), value: d.billed, display: formatINR(d.billed) }))} />
            </Card>
            <Card title="Collected per day">
              <ColumnChart title="Collected per day" data={data.series.map((d) => ({ label: formatDateKey(d.date), value: Math.max(0, d.collected), display: formatINR(d.collected) }))} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Sales by service">
              <HBarList data={data.services.map((s) => ({ label: s.name, value: s.amount, display: `${formatINR(s.amount)} · ${s.count}` }))} />
            </Card>
            <Card title="Payments by method">
              {Object.keys(data.sales.byMethod).length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Method</Th>
                      <Th className="text-right">Received</Th>
                      <Th className="text-right">Refunded</Th>
                      <Th className="text-right">Net</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.sales.byMethod).map(([m, v]) => (
                      <tr key={m}>
                        <Td>{PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m}</Td>
                        <Td className="text-right">{formatINR(v.collected)}</Td>
                        <Td className="text-right">{formatINR(v.refunded)}</Td>
                        <Td className="text-right font-medium">{formatINR(v.collected - v.refunded)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-stone">No payments in this period.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Bookings">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total" value={data.appointments.total} />
                <Stat label="Completed" value={`${data.appointments.completionRate}%`} />
                <Stat label="Cancelled" value={`${data.appointments.cancellationRate}%`} />
                <Stat label="No-shows" value={`${data.appointments.noShowRate}%`} />
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {Object.entries(data.appointments.byStatus).map(([s, n]) => (
                  <li key={s} className="flex justify-between">
                    <span className="text-stone">{STATUS_LABELS[s as AppointmentStatus] ?? s}</span>
                    <span>{n}</span>
                  </li>
                ))}
                <li className="flex justify-between">
                  <span className="text-stone">Walk-ins</span>
                  <span>{data.appointments.walkIns}</span>
                </li>
              </ul>
            </Card>
            <Card title="Staff workload">
              <HBarList data={data.workload.map((w) => ({ label: w.name, value: w.minutes, display: `${w.appointments} appts · ${w.completed} done · ${formatDuration(w.minutes)}` }))} />
            </Card>
          </div>

          <Card title="Discounts by type">
            {data.discounts.length ? (
              <ul className="space-y-1 text-sm">
                {data.discounts.map((d) => (
                  <li key={d.kind} className="flex justify-between">
                    <span className="capitalize text-stone">{d.kind} ({d.count})</span>
                    <span>{formatINR(d.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">No discounts given in this period.</p>
            )}
          </Card>

          {data.inventory && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Inventory usage">
                <HBarList data={data.inventory.usage.map((u) => ({ label: `${u.name} (${u.type})`, value: u.qty, display: `${u.qty} ${u.unit}` }))} />
              </Card>
              <Card title="Low stock">
                {data.inventory.lowStock.length ? (
                  <ul className="space-y-1 text-sm">
                    {data.inventory.lowStock.map((p) => (
                      <li key={p.name} className="flex justify-between">
                        <span>{p.name}</span>
                        <span className="text-warning">
                          {p.quantity} {p.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-stone">Nothing is low.</p>
                )}
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
