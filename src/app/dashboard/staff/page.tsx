"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { HoursEditor, TimeOffPanel, type Break, type DayHours } from "@/components/dashboard/StaffForms";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { GRANTABLE_PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  extraPermissions: string[];
  title: string;
  bio: string;
  bookable: boolean;
  services: string[];
  workingHours: DayHours[];
  breaks: Break[];
  lastLoginAt?: string;
}

export default function StaffPage() {
  return (
    <RequirePermission any={["staff.manage"]}>
      <StaffAdmin />
    </RequirePermission>
  );
}

function StaffAdmin() {
  const { data, error, loading, reload } = useApi<{ staff: Staff[] }>("/api/admin/staff");
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  return (
    <div>
      <PageHeader
        title="Staff & hours"
        description="Staff accounts are optional — if you run the salon alone, keep yourself as the only bookable stylist."
        actions={<Button onClick={() => setEditing("new")}>Add staff member</Button>}
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.staff.length ? (
        <EmptyState title="No staff yet" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.staff.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg">{s.name}</p>
                    <p className="text-sm text-stone">{s.title || s.role}</p>
                    <p className="mt-1 text-xs text-stone">{s.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-cream capitalize text-charcoal">{s.role}</Badge>
                    {!s.active && <Badge className="bg-[#fbefec] text-danger">Deactivated</Badge>}
                    {s.bookable && <Badge className="bg-[#eef5ef] text-success">Bookable</Badge>}
                  </div>
                </div>
                <p className="mt-3 text-xs text-stone">
                  {s.workingHours.length ? "Custom hours" : "Salon hours"} · {s.services.length ? `${s.services.length} services` : "All services"}
                  {s.lastLoginAt ? ` · last sign-in ${formatDateTime(s.lastLoginAt)}` : ""}
                </p>
                <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              </Card>
            ))}
          </div>
          <TimeOffPanel staffOptions={data.staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      )}
      {editing && <StaffModal staff={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

function StaffModal({ staff, onClose, onSaved }: { staff: Staff | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const services = useApi<{ services: { id: string; name: string; archived: boolean }[] }>("/api/admin/services");
  const [f, setF] = useState({
    name: staff?.name ?? "",
    email: staff?.email ?? "",
    phone: staff?.phone ?? "",
    role: staff?.role ?? "stylist",
    title: staff?.title ?? "",
    bio: staff?.bio ?? "",
    bookable: staff?.bookable ?? true,
    active: staff?.active ?? true,
    extraPermissions: staff?.extraPermissions ?? [],
    services: staff?.services ?? [],
    workingHours: staff?.workingHours ?? [],
    breaks: staff?.breaks ?? [],
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const isOwner = staff?.role === "owner";
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (staff) {
        const body: Record<string, unknown> = {
          name: f.name,
          email: f.email,
          phone: f.phone,
          title: f.title,
          bio: f.bio,
          bookable: f.bookable,
          services: f.services,
          workingHours: f.workingHours,
          breaks: f.breaks,
        };
        if (!isOwner) Object.assign(body, { role: f.role, active: f.active, extraPermissions: f.extraPermissions });
        if (f.password) body.newPassword = f.password;
        await apiFetch(`/api/admin/staff/${staff.id}`, { method: "PATCH", body });
      } else {
        const created = await apiFetch<{ staff: { id: string } }>("/api/admin/staff", {
          body: { name: f.name, email: f.email, phone: f.phone || undefined, role: f.role, title: f.title, bookable: f.bookable, password: f.password, extraPermissions: f.extraPermissions, services: f.services },
        });
        if (f.workingHours.length || f.breaks.length) {
          await apiFetch(`/api/admin/staff/${created.staff.id}`, { method: "PATCH", body: { workingHours: f.workingHours, breaks: f.breaks } });
        }
      }
      toast("Staff saved.");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={staff ? `Edit ${staff.name}` : "Add staff member"}
      size="lg"
      footer={
        <Button onClick={save} loading={busy}>
          Save
        </Button>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Senior Stylist" />
        <Input label="Email (sign-in)" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="Mobile" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {!isOwner && (
          <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="stylist">Stylist</option>
            <option value="receptionist">Receptionist</option>
          </Select>
        )}
        <Input
          label={staff ? "Reset password" : "Temporary password"}
          type="password"
          autoComplete="new-password"
          required={!staff}
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          hint={staff ? (staff.id === user?.id ? "Change your own password from My profile." : "Leave blank to keep the current password. Resetting signs them out.") : "Share privately; ask them to change it after first sign-in."}
          disabled={staff?.id === user?.id}
        />
        <Textarea label="Short bio" rows={2} wrapClassName="sm:col-span-2" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        <div className="space-y-2 sm:col-span-2">
          <Checkbox label="Takes appointments (bookable stylist)" checked={f.bookable} onChange={(e) => setF({ ...f, bookable: e.target.checked })} />
          {staff && !isOwner && <Checkbox label="Account active" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />}
        </div>
        {!isOwner && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Extra permissions (in addition to the role)</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {GRANTABLE_PERMISSIONS.map((p) => (
                <Checkbox key={p} label={PERMISSION_LABELS[p] ?? p} checked={f.extraPermissions.includes(p)} onChange={() => setF({ ...f, extraPermissions: toggle(f.extraPermissions, p) })} />
              ))}
            </div>
            <p className="mt-1 text-xs text-stone">Receptionists can book, check in and bill by default. Stylists see only their own schedule.</p>
          </fieldset>
        )}
        {f.bookable && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone">Services performed (none ticked = all services)</legend>
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {(services.data?.services ?? []).filter((s) => !s.archived).map((s) => (
                <Checkbox key={s.id} label={s.name} checked={f.services.includes(s.id)} onChange={() => setF({ ...f, services: toggle(f.services, s.id) })} />
              ))}
            </div>
          </fieldset>
        )}
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone">Working hours</p>
          <HoursEditor hours={f.workingHours} breaks={f.breaks} onChange={(workingHours, breaks) => setF({ ...f, workingHours, breaks })} />
        </div>
      </div>
    </Modal>
  );
}
