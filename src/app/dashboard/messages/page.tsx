"use client";

import { useState } from "react";
import { apiFetch, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Tabs, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { formatPhone } from "@/lib/format";

interface M {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  notes: string;
  at: string;
}

export default function MessagesPage() {
  return (
    <RequirePermission any={["messages.view"]}>
      <Messages />
    </RequirePermission>
  );
}

function Messages() {
  const toast = useToast();
  const [status, setStatus] = useState<"new" | "in_progress" | "resolved">("new");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<{ items: M[]; total: number; page: number; limit: number }>(`/api/admin/messages${qs({ status, page })}`);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(m: M, body: Record<string, unknown>) {
    try {
      await apiFetch(`/api/admin/messages/${m.id}`, { method: "PATCH", body });
      toast("Updated.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader title="Messages" description="Enquiries sent from the website contact form." />
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        tabs={[
          { id: "new", label: "New" },
          { id: "in_progress", label: "In progress" },
          { id: "resolved", label: "Resolved" },
        ]}
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="No messages" />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="rounded-lg border border-beige bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {m.name} {m.subject && <Badge className="ml-2">{m.subject}</Badge>}
                </p>
                <span className="text-xs text-stone">{formatDateTime(m.at)}</span>
              </div>
              <p className="mt-1 text-sm text-stone">
                {m.phone && (
                  <a href={`tel:+91${m.phone}`} className="hover:underline">
                    {formatPhone(m.phone)}
                  </a>
                )}
                {m.phone && m.email && " · "}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="hover:underline">
                    {m.email}
                  </a>
                )}
              </p>
              <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
              <Textarea label="Internal notes" rows={2} wrapClassName="mt-3" value={notes[m.id] ?? m.notes} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} />
              <div className="mt-3 flex flex-wrap gap-2">
                {m.status !== "in_progress" && (
                  <Button size="sm" variant="secondary" onClick={() => update(m, { status: "in_progress", notes: notes[m.id] ?? m.notes })}>
                    Mark in progress
                  </Button>
                )}
                {m.status !== "resolved" && (
                  <Button size="sm" onClick={() => update(m, { status: "resolved", notes: notes[m.id] ?? m.notes })}>
                    Mark resolved
                  </Button>
                )}
                {notes[m.id] !== undefined && notes[m.id] !== m.notes && (
                  <Button size="sm" variant="ghost" onClick={() => update(m, { notes: notes[m.id] })}>
                    Save notes
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
    </div>
  );
}
