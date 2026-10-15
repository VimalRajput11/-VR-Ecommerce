"use client";

import { useState } from "react";
import { qs, useApi, apiFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Card, ErrorState, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import AppointmentModal from "@/components/dashboard/AppointmentModal";
import NewBookingModal from "@/components/dashboard/NewBookingModal";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import type { StaffAppointment } from "@/components/dashboard/types";
import { dateKeyIST, formatTime } from "@/lib/time";
import { formatPhone } from "@/lib/format";

export default function FrontDeskPage() {
  return (
    <RequirePermission any={["appointments.manage"]}>
      <FrontDesk />
    </RequirePermission>
  );
}

function FrontDesk() {
  const today = dateKeyIST();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: StaffAppointment[] }>(`/api/admin/appointments${qs({ from: today, to: today, limit: 100 })}`);
  const [openId, setOpenId] = useState<string | null>(null);
  const [booking, setBooking] = useState<"walk_in" | "phone" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const all = data?.items ?? [];
  const waiting = all.filter((a) => a.status === "checked_in").sort((a, b) => (a.checkedInAt ?? "").localeCompare(b.checkedInAt ?? ""));
  const inChair = all.filter((a) => a.status === "in_progress");
  const expected = all.filter((a) => ["pending", "confirmed"].includes(a.status));
  const done = all.filter((a) => ["completed", "cancelled", "no_show"].includes(a.status));

  async function quick(a: StaffAppointment, status: string, label: string) {
    setBusy(a.id + status);
    try {
      await apiFetch(`/api/admin/appointments/${a.id}`, { method: "PATCH", body: { action: "status", status } });
      toast(`${a.customer.name}: ${label}`);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  const Row = ({ a, action }: { a: StaffAppointment; action?: { status: string; label: string } }) => (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(a.id)}>
        <span className="block font-medium">
          {formatTime(a.start)} · {a.customer.name}
        </span>
        <span className="block truncate text-xs text-stone">
          {a.items.map((i) => i.name).join(", ")}
          {a.stylist ? ` · ${a.stylist}` : ""}
          {a.customer.phone ? ` · ${formatPhone(a.customer.phone)}` : ""}
        </span>
      </button>
      <StatusBadge status={a.status} />
      {action && (
        <Button size="sm" loading={busy === a.id + action.status} onClick={() => quick(a, action.status, action.label)}>
          {action.label}
        </Button>
      )}
    </li>
  );

  return (
    <div>
      <PageHeader
        title="Front desk"
        description="Today's arrivals, waiting queue and walk-ins."
        actions={
          <>
            <Button variant="secondary" onClick={() => setBooking("phone")}>
              Phone booking
            </Button>
            <Button onClick={() => setBooking("walk_in")}>Register walk-in</Button>
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title={`Waiting (${waiting.length})`}>
            {waiting.length ? <ul className="divide-y divide-beige">{waiting.map((a) => <Row key={a.id} a={a} action={{ status: "in_progress", label: "Start" }} />)}</ul> : <p className="text-sm text-stone">No one is waiting.</p>}
          </Card>
          <Card title={`In the chair (${inChair.length})`}>
            {inChair.length ? <ul className="divide-y divide-beige">{inChair.map((a) => <Row key={a.id} a={a} action={{ status: "completed", label: "Complete" }} />)}</ul> : <p className="text-sm text-stone">No services in progress.</p>}
          </Card>
          <Card title={`Expected today (${expected.length})`}>
            {expected.length ? <ul className="divide-y divide-beige">{expected.map((a) => <Row key={a.id} a={a} action={{ status: "checked_in", label: "Arrived" }} />)}</ul> : <p className="text-sm text-stone">No more arrivals expected.</p>}
          </Card>
          <Card title={`Finished (${done.length})`} className="xl:col-span-3">
            {done.length ? <ul className="divide-y divide-beige">{done.map((a) => <Row key={a.id} a={a} />)}</ul> : <p className="text-sm text-stone">Nothing finished yet today.</p>}
          </Card>
        </div>
      )}
      <AppointmentModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <NewBookingModal open={!!booking} defaultSource={booking ?? "walk_in"} onClose={() => setBooking(null)} onCreated={reload} />
    </div>
  );
}
