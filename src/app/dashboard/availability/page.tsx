"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { HoursEditor, TimeOffPanel, type Break, type DayHours } from "@/components/dashboard/StaffForms";
import { Alert, Button, Card, PageHeader, Spinner } from "@/components/ui";

export default function AvailabilityPage() {
  return (
    <RequirePermission any={["availability.own"]}>
      <MyAvailability />
    </RequirePermission>
  );
}

function MyAvailability() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading } = useApi<{ staff: { id: string; workingHours: DayHours[]; breaks: Break[] }[] }>("/api/admin/staff");
  const me = data?.staff.find((s) => s.id === user?.id);
  const [hours, setHours] = useState<DayHours[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<typeof me>(undefined);
  if (me && me !== loadedFrom) {
    setLoadedFrom(me);
    setHours(me.workingHours ?? []);
    setBreaks(me.breaks ?? []);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/staff/${user!.id}`, { method: "PATCH", body: { workingHours: hours, breaks } });
      toast("Availability saved.");
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageHeader title="My availability" description="Your working hours and leave. Customers can only book you when you're available." />
      <Card title="Working hours">
        {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
        <HoursEditor hours={hours} breaks={breaks} onChange={(h, b) => { setHours(h); setBreaks(b); }} />
        <Button className="mt-4" onClick={save} loading={busy}>
          Save hours
        </Button>
      </Card>
      <TimeOffPanel fixedStaffId={user.id} />
    </div>
  );
}
