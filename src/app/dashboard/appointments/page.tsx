"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Spinner, StatusBadge, Table, Tabs, Td, Th, cx } from "@/components/ui";
import AppointmentModal from "@/components/dashboard/AppointmentModal";
import NewBookingModal from "@/components/dashboard/NewBookingModal";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import type { AdminService, StaffAppointment, StaffLite } from "@/components/dashboard/types";
import { APPOINTMENT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { addDaysToKey, dateKeyIST, formatDate, formatDateKey, formatLongDateKey, formatTime, minutesOfDayIST, weekdayName, weekdayOfDateKey } from "@/lib/time";
import { formatINR } from "@/lib/money";

type View = "day" | "week" | "list";

export default function AppointmentsPage() {
  return (
    <RequirePermission any={["appointments.view_all", "appointments.view_own"]}>
      <Suspense>
        <Appointments />
      </Suspense>
    </RequirePermission>
  );
}

function Appointments() {
  const { can } = useAuth();
  const params = useSearchParams();
  const today = dateKeyIST();
  const [view, setView] = useState<View>(params.get("status") || params.get("requests") ? "list" : "day");
  const [day, setDay] = useState(today);
  const [filters, setFiltersRaw] = useState({
    from: params.get("status") === "pending" ? today : addDaysToKey(today, -7),
    to: addDaysToKey(today, 30),
    status: params.get("status") ?? "",
    staff: "",
    service: "",
    q: "",
    requests: params.get("requests") ?? "",
  });
  const [page, setPage] = useState(1);
  const setFilters = (f: typeof filters) => {
    setFiltersRaw(f);
    setPage(1);
  };
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const [creating, setCreating] = useState(false);
  const viewAll = can("appointments.view_all");

  const staff = useApi<{ staff: StaffLite[] }>(viewAll ? "/api/admin/staff" : null);
  const services = useApi<{ services: AdminService[] }>(can("appointments.manage") ? "/api/admin/services" : null);

  const weekStart = addDaysToKey(day, -((weekdayOfDateKey(day) + 6) % 7)); // Monday
  const query =
    view === "list"
      ? qs({ ...filters, page, limit: 25, sort: "asc" })
      : qs({ from: view === "day" ? day : weekStart, to: view === "day" ? day : addDaysToKey(weekStart, 6), staff: filters.staff, status: filters.status, limit: 100 });
  const { data, error, loading, reload } = useApi<{ items: StaffAppointment[]; total: number; page: number; limit: number }>(`/api/admin/appointments${query}`);


  const shift = (n: number) => setDay(addDaysToKey(day, view === "week" ? n * 7 : n));
  const bookableStaff = (staff.data?.staff ?? []).filter((s) => s.bookable);

  return (
    <div>
      <PageHeader
        title={viewAll ? "Appointments" : "My schedule"}
        actions={can("appointments.manage") && <Button onClick={() => setCreating(true)}>New booking</Button>}
      />
      <Tabs<View>
        value={view}
        onChange={setView}
        tabs={[
          { id: "day", label: "Day" },
          { id: "week", label: "Week" },
          { id: "list", label: "List & filters" },
        ]}
      />

      {view !== "list" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDay(today)}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight size={16} />
          </Button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Go to date" className="rounded-md border border-sand bg-white px-2 py-1.5 text-sm" />
          <span className="font-serif text-lg">{view === "day" ? formatLongDateKey(day) : `${formatDateKey(weekStart)} – ${formatDateKey(addDaysToKey(weekStart, 6))}`}</span>
          {viewAll && (
            <select value={filters.staff} onChange={(e) => setFilters({ ...filters, staff: e.target.value })} aria-label="Stylist" className="ml-auto rounded-md border border-sand bg-white px-2 py-1.5 text-sm">
              <option value="">All stylists</option>
              {bookableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="mb-4 grid gap-3 rounded-lg border border-beige bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Input label="Search" placeholder="Name, phone or ref" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          {viewAll ? (
            <Select label="Stylist" value={filters.staff} onChange={(e) => setFilters({ ...filters, staff: e.target.value })}>
              <option value="">All stylists</option>
              {bookableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <span />
          )}
          {services.data ? (
            <Select label="Service" value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })}>
              <option value="">All services</option>
              {services.data.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <span />
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-3 lg:col-span-6">
            <input type="checkbox" className="accent-[#85652f]" checked={filters.requests === "1"} onChange={(e) => setFilters({ ...filters, requests: e.target.checked ? "1" : "" })} />
            Only customer change requests
          </label>
        </div>
      )}

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No appointments">Nothing matches this view.</EmptyState>
      ) : view === "list" ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Customer</Th>
                <Th>Services</Th>
                <Th>Stylist</Th>
                <Th>Status</Th>
                <Th className="text-right">Est.</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-cream/50" onClick={() => setOpenId(a.id)}>
                  <Td>
                    <button type="button" className="text-left font-medium" onClick={() => setOpenId(a.id)}>
                      {formatDate(a.start)}
                      <span className="block text-xs text-stone">{formatTime(a.start)} · {a.ref}</span>
                    </button>
                  </Td>
                  <Td>
                    {a.customer.name}
                    {a.request?.type && !a.request.resolved && <span className="ml-1 rounded bg-[#fbefec] px-1.5 text-[10px] text-danger">{a.request.type} request</span>}
                  </Td>
                  <Td className="max-w-[240px] truncate">{a.items.map((i) => i.name).join(", ")}</Td>
                  <Td>{a.stylist}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td className="text-right">{formatINR(a.estimatedTotal)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      ) : view === "day" ? (
        <DaySchedule items={data.items} staff={viewAll ? bookableStaff.filter((s) => !filters.staff || s.id === filters.staff) : []} onOpen={setOpenId} />
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).map((d) => {
            const items = data.items.filter((a) => dateKeyIST(new Date(a.start)) === d);
            return (
              <div key={d} className={cx("rounded-lg border bg-white p-2", d === today ? "border-gold" : "border-beige")}>
                <button type="button" onClick={() => { setDay(d); setView("day"); }} className="mb-2 w-full text-left text-sm font-medium hover:underline">
                  {weekdayName(weekdayOfDateKey(d), true)} {formatDateKey(d).slice(0, 5)}
                </button>
                {items.length ? (
                  <ul className="space-y-1">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setOpenId(a.id)} className="w-full rounded bg-cream px-2 py-1 text-left text-xs hover:bg-beige">
                          <span className="font-medium">{formatTime(a.start)}</span> {a.customer.name}
                          <span className="block truncate text-stone">{STATUS_LABELS[a.status as keyof typeof STATUS_LABELS]}{a.stylist ? ` · ${a.stylist}` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone">—</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AppointmentModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <NewBookingModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </div>
  );
}

/** Time-grid schedule: one column per stylist (or a single column for one's own schedule). */
function DaySchedule({ items, staff, onOpen }: { items: StaffAppointment[]; staff: StaffLite[]; onOpen: (id: string) => void }) {
  const columns = staff.length ? staff.map((s) => ({ id: s.id, name: s.name })) : [{ id: "", name: "" }];
  const visible = items.filter((a) => !["cancelled"].includes(a.status));
  const starts = visible.map((a) => minutesOfDayIST(new Date(a.start)));
  const ends = visible.map((a) => minutesOfDayIST(new Date(a.end)));
  const open = Math.min(9 * 60, ...starts);
  const close = Math.max(21 * 60, ...ends);
  const PX = 1.1; // pixels per minute
  const hours = Array.from({ length: Math.ceil((close - open) / 60) + 1 }, (_, i) => Math.floor(open / 60) + i);
  const cancelled = items.filter((a) => a.status === "cancelled");

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-beige bg-white">
        <div className="flex min-w-fit">
          <div className="w-16 shrink-0 border-r border-beige pt-9">
            {hours.map((h) => (
              <div key={h} className="relative text-right text-[11px] text-stone" style={{ height: 60 * PX }}>
                <span className="absolute -top-2 right-2">{h % 12 === 0 ? 12 : h % 12} {h >= 12 ? "PM" : "AM"}</span>
              </div>
            ))}
          </div>
          {columns.map((col) => (
            <div key={col.id || "me"} className="min-w-[180px] flex-1 border-r border-beige last:border-r-0">
              <div className="h-9 border-b border-beige px-2 py-2 text-sm font-medium">{col.name || "My appointments"}</div>
              <div className="relative" style={{ height: hours.length * 60 * PX }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-beige/70" style={{ top: (h * 60 - Math.floor(open / 60) * 60) * PX }} />
                ))}
                {visible
                  .filter((a) => !col.id || a.staffId === col.id)
                  .map((a) => {
                    const top = (minutesOfDayIST(new Date(a.start)) - Math.floor(open / 60) * 60) * PX;
                    const height = Math.max(26, a.durationMin * PX);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onOpen(a.id)}
                        className={cx(
                          "absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm",
                          a.status === "completed" ? "border-success bg-[#eef5ef]" : a.status === "in_progress" ? "border-gold-deep bg-[#f6efe4]" : a.status === "checked_in" ? "border-[#5a3f86] bg-[#efeaf6]" : a.status === "no_show" ? "border-danger bg-[#fbefec]" : a.status === "pending" ? "border-warning bg-[#fbf3e3]" : "border-[#2b5476] bg-[#eaf1f7]",
                        )}
                        style={{ top, height }}
                      >
                        <span className="font-semibold">{formatTime(a.start)}</span> {a.customer.name}
                        <span className="block truncate text-stone">{a.items.map((i) => i.name).join(", ")}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {cancelled.length > 0 && (
        <p className="mt-3 text-xs text-stone">
          Cancelled today:{" "}
          {cancelled.map((a, i) => (
            <button key={a.id} type="button" className="underline" onClick={() => onOpen(a.id)}>
              {i ? ", " : ""}
              {formatTime(a.start)} {a.customer.name}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
