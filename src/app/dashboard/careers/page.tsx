"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { apiFetch, ApiClientError, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, Select, Spinner, Tabs, Textarea, buttonClass } from "@/components/ui";
import { APPLICATION_STATUS_LABELS, JOB_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatPhone } from "@/lib/format";

interface Opening {
  id: string;
  title: string;
  type: string;
  description: string;
  requirements: string;
  experience: string;
  salary: string;
  active: boolean;
  archived: boolean;
  order: number;
  postedAt?: string;
  applications: { total: number; new: number };
}

interface Application {
  id: string;
  openingId: string | null;
  position: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  experienceYears: number;
  skills: string;
  portfolioUrl: string;
  message: string;
  status: string;
  notes: string;
  at: string;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[#fbf3e3] text-warning",
  shortlisted: "bg-[#eaf1f7] text-[#2b5476]",
  interview: "bg-[#efeaf6] text-[#5a3f86]",
  hired: "bg-[#eef5ef] text-success",
  rejected: "bg-[#f3eeea] text-stone",
};

export default function CareersAdminPage() {
  return (
    <RequirePermission any={["careers.manage"]}>
      <CareersAdmin />
    </RequirePermission>
  );
}

function CareersAdmin() {
  const [tab, setTab] = useState<"applications" | "openings">("applications");
  const openings = useApi<{ openings: Opening[]; general: { total: number; new: number } }>("/api/admin/careers?archived=1");
  const newTotal = (openings.data?.openings ?? []).reduce((s, o) => s + o.applications.new, 0) + (openings.data?.general.new ?? 0);
  return (
    <div>
      <PageHeader title="Careers & hiring" description="Post job openings on the website and review applications." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "applications", label: <>Applications{newTotal ? <Badge className="ml-2 bg-gold text-charcoal">{newTotal} new</Badge> : null}</> },
          { id: "openings", label: "Job openings" },
        ]}
      />
      {tab === "applications" ? <Applications openings={openings.data?.openings ?? []} onChanged={openings.reload} /> : <Openings state={openings} />}
    </div>
  );
}

function Openings({ state }: { state: ReturnType<typeof useApi<{ openings: Opening[]; general: { total: number; new: number } }>> }) {
  const toast = useToast();
  const { data, error, loading, reload } = state;
  const [editing, setEditing] = useState<Opening | "new" | null>(null);
  const live = (data?.openings ?? []).filter((o) => !o.archived);
  const archived = (data?.openings ?? []).filter((o) => o.archived);

  async function patch(o: Opening, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/admin/careers/${o.id}`, { method: "PATCH", body });
      toast(msg);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone">Open positions appear on the public Careers page. Closed or archived ones are hidden.</p>
        <Button onClick={() => setEditing("new")}>Post a job</Button>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : live.length === 0 ? (
        <EmptyState title="No job openings" action={<Button onClick={() => setEditing("new")}>Post your first job</Button>}>
          While there are no openings, the Careers page still accepts general applications.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {live.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg">{o.title}</p>
                  <p className="text-sm text-stone">
                    {JOB_TYPE_LABELS[o.type]}
                    {o.experience ? ` · ${o.experience}` : ""}
                    {o.salary ? ` · ${o.salary}` : ""}
                  </p>
                  {o.postedAt && <p className="mt-1 text-xs text-stone">Posted {formatDate(o.postedAt)}</p>}
                </div>
                {o.active ? <Badge className="bg-[#eef5ef] text-success">Open</Badge> : <Badge>Closed</Badge>}
              </div>
              <p className="mt-3 text-sm">
                {o.applications.total} application{o.applications.total === 1 ? "" : "s"}
                {o.applications.new ? <span className="text-warning"> · {o.applications.new} new</span> : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(o)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => patch(o, { active: !o.active }, o.active ? "Opening closed" : "Opening reopened")}>
                  {o.active ? "Close" : "Reopen"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={async () => {
                    if (!confirm(`Archive "${o.title}"? Its applications are kept.`)) return;
                    await apiFetch(`/api/admin/careers/${o.id}`, { method: "DELETE" });
                    toast("Opening archived");
                    reload();
                  }}
                >
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-stone">Archived openings ({archived.length})</summary>
          <ul className="mt-2 divide-y divide-beige rounded-md border border-beige bg-white text-sm">
            {archived.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {o.title} · {o.applications.total} applications
                </span>
                <Button size="sm" variant="ghost" onClick={() => patch(o, { archived: false, active: false }, "Restored (closed)")}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing && <OpeningModal opening={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

function OpeningModal({ opening, onClose, onSaved }: { opening: Opening | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: opening?.title ?? "",
    type: opening?.type ?? "full_time",
    experience: opening?.experience ?? "",
    salary: opening?.salary ?? "",
    description: opening?.description ?? "",
    requirements: opening?.requirements ?? "",
    active: opening?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (opening) await apiFetch(`/api/admin/careers/${opening.id}`, { method: "PATCH", body: f });
      else await apiFetch("/api/admin/careers", { body: f });
      toast(opening ? "Opening updated" : "Job posted");
      onSaved();
      onClose();
    } catch (e) {
      setError(e as ApiClientError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={opening ? `Edit ${opening.title}` : "Post a job"} size="lg" footer={<Button onClick={save} loading={busy}>Save</Button>}>
      {error && <Alert tone="error" className="mb-4">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Job title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Hair Stylist, Beautician, Receptionist" wrapClassName="sm:col-span-2" />
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="Experience" value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} placeholder="e.g. 2+ years, or Freshers welcome" />
        <Input label="Salary (optional)" value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value })} placeholder="e.g. ₹15,000–₹25,000/month + incentives" hint="Leave empty to hide salary on the website." wrapClassName="sm:col-span-2" />
        <Textarea label="About the role" rows={4} wrapClassName="sm:col-span-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Textarea label="Requirements" rows={4} wrapClassName="sm:col-span-2" value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} />
        <Checkbox label="Open — show on the website" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
      </div>
    </Modal>
  );
}

function Applications({ openings, onChanged }: { openings: Opening[]; onChanged: () => void }) {
  const toast = useToast();
  const [filters, setFiltersRaw] = useState({ status: "", opening: "", q: "" });
  const [page, setPage] = useState(1);
  const setFilters = (f: typeof filters) => {
    setFiltersRaw(f);
    setPage(1);
  };
  const { data, error, loading, reload } = useApi<{ items: Application[]; total: number; page: number; limit: number }>(`/api/admin/careers/applications${qs({ ...filters, page })}`);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(a: Application, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/admin/careers/applications/${a.id}`, { method: "PATCH", body });
      toast(msg);
      reload();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(a: Application) {
    if (!confirm(`Permanently delete ${a.name}'s application and personal details?`)) return;
    await apiFetch(`/api/admin/careers/applications/${a.id}`, { method: "DELETE" });
    toast("Application deleted");
    reload();
    onChanged();
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-lg border border-beige bg-white p-4 sm:grid-cols-4">
        <Input label="Search" placeholder="Name, phone, city…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <Select label="Position" value={filters.opening} onChange={(e) => setFilters({ ...filters, opening: e.target.value })}>
          <option value="">All positions</option>
          <option value="general">General applications</option>
          {openings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </Select>
        <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Any status</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <div className="flex items-end">
          <a href={`/api/admin/careers/applications${qs({ ...filters, format: "csv" })}`} className={buttonClass("secondary", "md", "w-full")}>
            <Download size={16} aria-hidden /> Export CSV
          </a>
        </div>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No applications">Applications sent from the website&apos;s Careers page appear here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.items.map((a) => (
            <li key={a.id} className="rounded-lg border border-beige bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg">{a.name}</p>
                  <p className="text-sm text-stone">
                    {a.position} · {a.experienceYears} yr{a.experienceYears === 1 ? "" : "s"} experience{a.city ? ` · ${a.city}` : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    <a href={`tel:+91${a.phone}`} className="hover:underline">
                      {formatPhone(a.phone)}
                    </a>
                    {a.email && (
                      <>
                        {" · "}
                        <a href={`mailto:${a.email}`} className="hover:underline">
                          {a.email}
                        </a>
                      </>
                    )}
                    {" · "}
                    <a href={`https://wa.me/91${a.phone}`} target="_blank" rel="noopener noreferrer" className="text-gold-deep hover:underline">
                      WhatsApp
                    </a>
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={STATUS_STYLE[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
                  <p className="mt-1 text-xs text-stone">{formatDateTime(a.at)}</p>
                </div>
              </div>
              {a.skills && <p className="mt-3 text-sm"><span className="text-stone">Skills:</span> {a.skills}</p>}
              {a.message && <p className="mt-2 whitespace-pre-line text-sm">{a.message}</p>}
              {a.portfolioUrl && (
                <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-sm text-gold-deep underline">
                  View their work <ExternalLink size={13} aria-hidden />
                </a>
              )}
              <Textarea label="Private notes" rows={2} wrapClassName="mt-3" value={notes[a.id] ?? a.notes} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} hint="Only visible to you." />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {Object.entries(APPLICATION_STATUS_LABELS)
                  .filter(([k]) => k !== a.status)
                  .map(([k, v]) => (
                    <Button key={k} size="sm" variant={k === "rejected" ? "ghost" : "secondary"} onClick={() => update(a, { status: k, notes: notes[a.id] ?? a.notes }, `Marked ${v}`)}>
                      {v}
                    </Button>
                  ))}
                {notes[a.id] !== undefined && notes[a.id] !== a.notes && (
                  <Button size="sm" onClick={() => update(a, { notes: notes[a.id] }, "Notes saved")}>
                    Save notes
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => remove(a)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
    </div>
  );
}
