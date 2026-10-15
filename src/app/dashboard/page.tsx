"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button, Card, ErrorState, Input, PageHeader, Spinner, Stat, StatusBadge } from "@/components/ui";
import { ColumnChart, HBarList } from "@/components/dashboard/BarChart";
import AppointmentModal from "@/components/dashboard/AppointmentModal";
import NewBookingModal from "@/components/dashboard/NewBookingModal";
import type { StaffAppointment } from "@/components/dashboard/types";
import { addDaysToKey, dateKeyIST, formatDateKey, formatTime } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/format";

interface Sales {
  invoices: number;
  gross: number;
  discounts: number;
  tax: number;
  billed: number;
  refunds: number;
  net: number;
  collected: number;
}

interface Overview {
  range: { from: string; to: string };
  today: { stats: { total: number; byStatus: Record<string, number>; walkIns: number }; appointments: StaffAppointment[] };
  upcomingCount: number;
  rangeStats: { total: number; byStatus: Record<string, number>; walkIns: number; completionRate: number; cancellationRate: number; noShowRate: number };
  alerts?: { pendingRequests: number; pendingConfirm: number; newMessages: number; pendingReviews: number; unverifiedPrices: number; newApplications: number };
  popular?: { name: string; count: number }[];
  workload?: { staffId: string; name: string; appointments: number; minutes: number; completed: number }[];
  sales?: { today: Sales; month: Sales; range: Sales; outstanding: { amount: number; count: number }; series: { date: string; billed: number; collected: number }[] };
  lowStock?: { id: string; name: string; quantity: number; unit: string; threshold: number }[];
}

const PRESETS = [
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
];

export default function OverviewPage() {
  const { user, can } = useAuth();
  const today = dateKeyIST();
  const [range, setRange] = useState({ from: addDaysToKey(today, -29), to: today });
  const { data, error, loading, reload } = useApi<Overview>(`/api/admin/overview${qs(range)}`);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newBooking, setNewBooking] = useState(false);

  return (
    <div>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Today is ${formatDateKey(today)}`}
        actions={
          can("appointments.manage") && (
            <Button onClick={() => setNewBooking(true)}>New booking</Button>
          )
        }
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6">
          {data.alerts && (
            <div className="flex flex-wrap gap-2">
              {data.alerts.unverifiedPrices > 0 && (
                <Link href="/dashboard/services" className="inline-flex items-center gap-1.5 rounded-full bg-[#fbf3e3] px-3 py-1 text-xs text-warning">
                  <AlertTriangle size={13} aria-hidden /> {data.alerts.unverifiedPrices} service prices need verifying
                </Link>
              )}
              {data.alerts.pendingConfirm > 0 && (
                <Link href="/dashboard/appointments?status=pending" className="rounded-full bg-[#fbf3e3] px-3 py-1 text-xs text-warning">
                  {data.alerts.pendingConfirm} bookings awaiting confirmation
                </Link>
              )}
              {data.alerts.pendingRequests > 0 && (
                <Link href="/dashboard/appointments?requests=1" className="rounded-full bg-[#fbefec] px-3 py-1 text-xs text-danger">
                  {data.alerts.pendingRequests} customer change requests
                </Link>
              )}
              {data.alerts.newMessages > 0 && (
                <Link href="/dashboard/messages" className="rounded-full bg-cream px-3 py-1 text-xs text-charcoal">
                  {data.alerts.newMessages} new messages
                </Link>
              )}
              {data.alerts.newApplications > 0 && (
                <Link href="/dashboard/careers" className="rounded-full bg-cream px-3 py-1 text-xs text-charcoal">
                  {data.alerts.newApplications} new job application{data.alerts.newApplications === 1 ? "" : "s"}
                </Link>
              )}
              {data.alerts.pendingReviews > 0 && (
                <Link href="/dashboard/reviews" className="rounded-full bg-cream px-3 py-1 text-xs text-charcoal">
                  {data.alerts.pendingReviews} reviews to moderate
                </Link>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="Today's appointments" value={data.today.stats.total} />
            <Stat label="Completed today" value={data.today.stats.byStatus.completed ?? 0} />
            <Stat label="Cancelled today" value={data.today.stats.byStatus.cancelled ?? 0} />
            <Stat label="Walk-ins today" value={data.today.stats.walkIns} />
            <Stat label="Upcoming (7 days)" value={data.upcomingCount} />
            {data.sales && <Stat label="Outstanding" value={formatINR(data.sales.outstanding.amount)} hint={`${data.sales.outstanding.count} invoice${data.sales.outstanding.count === 1 ? "" : "s"}`} tone={data.sales.outstanding.amount ? "warning" : "default"} />}
          </div>

          {data.sales && (
            <div className="grid gap-3 md:grid-cols-2">
              <SalesCard title="Today's sales" s={data.sales.today} />
              <SalesCard title="This month" s={data.sales.month} />
            </div>
          )}

          <Card title={user?.permissions.includes("appointments.view_all") ? "Today's schedule" : "My appointments today"} actions={<Link href="/dashboard/appointments" className="text-sm text-gold-deep underline">All appointments</Link>}>
            {data.today.appointments.length === 0 ? (
              <p className="text-sm text-stone">No appointments today.</p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.today.appointments.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setOpenId(a.id)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-cream/50">
                      <span className="w-20 font-medium">{formatTime(a.start)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.customer.name}</span>
                        <span className="block truncate text-xs text-stone">
                          {a.items.map((i) => i.name).join(", ")} · {formatDuration(a.durationMin)}
                          {a.stylist ? ` · ${a.stylist}` : ""}
                        </span>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-beige bg-white p-4">
            <span className="text-sm font-medium">Period</span>
            {PRESETS.map((p) => (
              <Button key={p.days} size="sm" variant={range.from === addDaysToKey(range.to, -p.days) ? "primary" : "secondary"} onClick={() => setRange({ from: addDaysToKey(today, -p.days), to: today })}>
                {p.label}
              </Button>
            ))}
            <Input label="From" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} wrapClassName="w-40" />
            <Input label="To" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} wrapClassName="w-40" />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Appointments" value={data.rangeStats.total} hint={`${formatDateKey(data.range.from)} – ${formatDateKey(data.range.to)}`} />
            <Stat label="Completion rate" value={`${data.rangeStats.completionRate}%`} />
            <Stat label="Cancellation rate" value={`${data.rangeStats.cancellationRate}%`} />
            <Stat label="No-show rate" value={`${data.rangeStats.noShowRate}%`} />
          </div>

          {data.sales && (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card title="Payments collected per day">
                <ColumnChart
                  title="Payments collected per day"
                  data={data.sales.series.map((d) => ({ label: formatDateKey(d.date), value: Math.max(0, d.collected), display: formatINR(d.collected) }))}
                />
              </Card>
              <SalesCard title="Selected period" s={data.sales.range} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {data.popular && (
              <Card title="Popular services">
                <HBarList data={data.popular.map((p) => ({ label: p.name, value: p.count, display: `${p.count} booked` }))} />
              </Card>
            )}
            {data.workload && (
              <Card title="Staff workload">
                <HBarList data={data.workload.map((w) => ({ label: w.name, value: w.minutes, display: `${w.appointments} appts · ${formatDuration(w.minutes)}` }))} />
              </Card>
            )}
          </div>

          {data.lowStock && (
            <Card title="Low-stock alerts" actions={<Link href="/dashboard/inventory" className="text-sm text-gold-deep underline">Inventory</Link>}>
              {data.lowStock.length ? (
                <ul className="divide-y divide-beige text-sm">
                  {data.lowStock.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>{p.name}</span>
                      <span className="text-warning">
                        {p.quantity} {p.unit} left (alert at {p.threshold})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone">All products are above their alert levels.</p>
              )}
            </Card>
          )}
          {!data.sales && can("billing.manage") && <Alert tone="info">Sales figures are visible to the owner in Reports.</Alert>}
        </div>
      ) : null}
      <AppointmentModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <NewBookingModal open={newBooking} onClose={() => setNewBooking(false)} onCreated={reload} />
    </div>
  );
}

function SalesCard({ title, s }: { title: string; s: Sales }) {
  const rows: [string, number, string?][] = [
    ["Gross sales", s.gross],
    ["Discounts", -s.discounts],
    ["Tax", s.tax],
    ["Billed", s.billed, "font-medium"],
    ["Refunds", -s.refunds],
    ["Net sales", s.net, "font-semibold"],
  ];
  return (
    <Card title={title}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-stone">Collected</p>
        <p className="font-serif text-2xl">{formatINR(s.collected)}</p>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        {rows.map(([label, value, cls]) => (
          <div key={label} className={`flex justify-between ${cls ?? ""}`}>
            <dt className="text-stone">{label}</dt>
            <dd>{value < 0 ? `−${formatINR(-value)}` : formatINR(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-stone">{s.invoices} invoice{s.invoices === 1 ? "" : "s"}. Collected = payments received − refunds paid in the period.</p>
    </Card>
  );
}
