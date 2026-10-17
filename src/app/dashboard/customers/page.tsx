"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, Spinner, Stat, StatusBadge, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { formatPhone } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  phone: string;
  email: string;
  isGuest: boolean;
  lastVisitAt?: string;
  totalPaid: number;
  balanceDue: number;
}

export default function CustomersPage() {
  return (
    <RequirePermission any={["customers.view"]}>
      <Suspense>
        <Customers />
      </Suspense>
    </RequirePermission>
  );
}

/** Owner only: wipe every customer and their history (e.g. test data before going live). */
function DeleteAllCustomersModal({ count, onClose, onDone }: { count: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ customers: number; appointments: number; invoices: number }>("/api/admin/customers", { method: "DELETE", body: { confirm } });
      toast(`Deleted ${res.customers} customers, ${res.appointments} appointments and ${res.invoices} invoices.`);
      onDone();
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
      title="Delete all customers?"
      footer={
        <Button variant="danger" disabled={confirm !== "DELETE"} loading={busy} onClick={run}>
          Delete all customers
        </Button>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="space-y-3 text-sm">
        <p>
          This permanently deletes <strong>all {count} customer{count === 1 ? "" : "s"}</strong> and everything linked to them: their <strong>bills and payments</strong>,{" "}
          appointments, reviews, advance balances, memberships, gift cards, saved bills and notifications. Reports go back to zero and invoice numbers restart.
        </p>
        <p className="text-stone">Staff, services, offers, products and stock levels are kept.</p>
        <p className="font-medium text-danger">This can&apos;t be undone.</p>
        <Input label='Type "DELETE" to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </div>
    </Modal>
  );
}

function Customers() {
  const { user, can } = useAuth();
  const [clearing, setClearing] = useState(false);
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(params.get("id"));
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useApi<{ items: Row[]; total: number; page: number; limit: number }>(`/api/admin/customers${qs({ q: debounced, page })}`);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Search by name, phone or email."
        actions={
          <>
            {can("customers.export") && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from an API route, not a page
              <a href="/api/admin/customers/export" className={buttonClass("secondary")}>
                <Download size={16} aria-hidden /> Export CSV
              </a>
            )}
            {user?.role === "owner" && !!data?.total && !debounced && (
              <Button variant="secondary" onClick={() => setClearing(true)}>
                <Trash2 size={16} aria-hidden /> Delete all
              </Button>
            )}
            {(can("customers.manage") || can("appointments.manage")) && <Button onClick={() => setAdding(true)}>Add customer</Button>}
          </>
        }
      />
      {clearing && <DeleteAllCustomersModal count={data?.total ?? 0} onClose={() => setClearing(false)} onDone={reload} />}
      <Input label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or email" wrapClassName="mb-4 max-w-md" />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No customers found">{debounced ? "Try a different search." : "Customers appear here after their first booking."}</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th>Last visit</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Due</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-cream/50" onClick={() => setOpenId(c.id)}>
                  <Td>
                    <button type="button" className="font-medium hover:underline" onClick={() => setOpenId(c.id)}>
                      {c.name}
                    </button>
                    {c.isGuest && <Badge className="ml-2 bg-cream text-stone">Guest</Badge>}
                  </Td>
                  <Td>{formatPhone(c.phone)}</Td>
                  <Td>{c.email}</Td>
                  <Td>{c.lastVisitAt ? formatDate(c.lastVisitAt) : "—"}</Td>
                  <Td className="text-right">{formatINR(c.totalPaid)}</Td>
                  <Td className={`text-right ${c.balanceDue ? "text-danger" : ""}`}>{formatINR(c.balanceDue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </>
      )}
      <CustomerModal id={openId} onClose={() => setOpenId(null)} onSaved={reload} />
      <AddCustomerModal open={adding} onClose={() => setAdding(false)} onSaved={reload} />
    </div>
  );
}

interface Detail {
  customer: { id: string; name: string; phone: string; email: string; isGuest: boolean; preferences: string; internalNotes?: string; marketingConsent: boolean; loyaltyPoints: number; firstVisitAt?: string; lastVisitAt?: string; createdAt: string };
  summary: { visits: number; cancelled: number; noShows: number; billed: number; paid: number; due: number };
  appointments: { id: string; ref: string; start: string; status: string; services: string; stylist: string; serviceNotes: string }[];
  invoices: { id: string; number: string; issuedAt: string; total: number; balanceDue: number; status: string }[];
}

function CustomerModal({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const { data, error, loading } = useApi<Detail>(id ? `/api/admin/customers/${id}` : null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferences: "", internalNotes: "", marketingConsent: false });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<ApiClientError | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<typeof data>(null);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setForm({
      name: data.customer.name,
      phone: data.customer.phone,
      email: data.customer.email,
      preferences: data.customer.preferences,
      internalNotes: data.customer.internalNotes ?? "",
      marketingConsent: data.customer.marketingConsent,
    });
  }
  const manage = can("customers.manage");
  const notesAllowed = data?.customer.internalNotes !== undefined;

  // Owner only: remove this customer and their history for good.
  async function remove() {
    if (!data) return;
    const c = data.customer;
    const bills = `${data.invoices.length} bill${data.invoices.length === 1 ? "" : "s"}`;
    const appts = `${data.appointments.length} appointment${data.appointments.length === 1 ? "" : "s"}`;
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      danger: true,
      confirmLabel: "Delete customer",
      message: (
        <>
          <p>
            This permanently deletes <strong>{c.name}</strong> and their <strong>{bills}</strong>, <strong>{appts}</strong>, payments, advance balance, membership and gift cards.
          </p>
          <p className="font-medium text-danger">This can&apos;t be undone.</p>
        </>
      ),
    });
    if (!ok) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      toast(`${c.name} deleted.`);
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e as ApiClientError);
    } finally {
      setDeleting(false);
    }
  }

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/admin/customers/${id}`, { method: "PATCH", body: manage ? form : { internalNotes: form.internalNotes } });
      toast("Customer saved.");
      onSaved();
    } catch (e) {
      setSaveError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      title={data?.customer.name ?? "Customer"}
      size="xl"
      footer={
        <>
          {user?.role === "owner" && data && (
            <Button variant="ghost" className="mr-auto text-danger" loading={deleting} onClick={remove}>
              <Trash2 size={16} aria-hidden /> Delete customer
            </Button>
          )}
          {(manage || notesAllowed) && (
            <Button onClick={save} loading={busy}>
              Save changes
            </Button>
          )}
        </>
      }
    >
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : data ? (
        <div className="space-y-6">
          {saveError && <Alert tone="error">{saveError.message}</Alert>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Visits" value={data.summary.visits} />
            <Stat label="Cancelled" value={data.summary.cancelled} />
            <Stat label="No-shows" value={data.summary.noShows} />
            <Stat label="Total paid" value={formatINR(data.summary.paid)} />
            <Stat label="Balance due" value={formatINR(data.summary.due)} tone={data.summary.due ? "warning" : "default"} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Name" value={form.name} disabled={!manage} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Phone" value={form.phone} disabled={!manage} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} disabled={!manage} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Textarea label="Service preferences" wrapClassName="md:col-span-3" rows={2} value={form.preferences} disabled={!manage} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
            {notesAllowed && <Textarea label="Internal notes (staff only)" wrapClassName="md:col-span-3" rows={2} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />}
            {manage && (
              <Checkbox
                className="md:col-span-3"
                label="Agreed to receive offers (WhatsApp / email)"
                checked={form.marketingConsent}
                onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
              />
            )}
          </div>
          <p className="text-xs text-stone">
            {data.customer.isGuest ? "Guest profile" : "Registered account"} · since {formatDate(data.customer.createdAt)} · loyalty points: {data.customer.loyaltyPoints}
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-serif text-lg">Appointment history</h3>
              {data.appointments.length ? (
                <ul className="max-h-72 divide-y divide-beige overflow-y-auto rounded-md border border-beige bg-white text-sm">
                  {data.appointments.map((a) => (
                    <li key={a.id} className="p-3">
                      <div className="flex justify-between gap-2">
                        <Link href={`/dashboard/appointments?id=${a.id}`} className="font-medium hover:underline">
                          {formatDate(a.start)} · {a.ref}
                        </Link>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-xs text-stone">
                        {a.services}
                        {a.stylist ? ` · ${a.stylist}` : ""}
                      </p>
                      {a.serviceNotes && <p className="mt-1 text-xs">Notes: {a.serviceNotes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone">No appointments.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-serif text-lg">Invoices</h3>
              {data.invoices.length ? (
                <ul className="max-h-72 divide-y divide-beige overflow-y-auto rounded-md border border-beige bg-white text-sm">
                  {data.invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 p-3">
                      {can("billing.manage") ? (
                        <Link href={`/dashboard/billing/${i.id}`} className="font-mono hover:underline">
                          {i.number}
                        </Link>
                      ) : (
                        <span className="font-mono">{i.number}</span>
                      )}
                      <span className="text-xs text-stone">{formatDate(i.issuedAt)}</span>
                      <span>{formatINR(i.total)}</span>
                      <StatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone">No invoices.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function AddCustomerModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferences: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/customers", { body: form });
      toast("Customer added.");
      setForm({ name: "", phone: "", email: "", preferences: "" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add customer" size="sm" footer={<Button onClick={save} loading={busy}>Add</Button>}>
      {error && <Alert tone="error" className="mb-3">{error.message}</Alert>}
      <div className="space-y-3">
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Mobile" required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Textarea label="Preferences" rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
      </div>
    </Modal>
  );
}
