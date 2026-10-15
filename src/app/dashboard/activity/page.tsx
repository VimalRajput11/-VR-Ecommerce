"use client";

import { useEffect, useState } from "react";
import { qs, useApi } from "@/lib/api";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Badge, EmptyState, ErrorState, Input, PageHeader, Pagination, Spinner, Table, Tabs, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

export default function ActivityPage() {
  return (
    <RequirePermission any={["audit.view"]}>
      <Activity />
    </RequirePermission>
  );
}

function Activity() {
  const [tab, setTab] = useState<"audit" | "notifications">("audit");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const audit = useApi<{ items: { id: string; at: string; actor: string; role: string; action: string; summary: string }[]; total: number; page: number; limit: number }>(
    tab === "audit" ? `/api/admin/audit${qs({ q: debounced, page })}` : null,
  );
  const notes = useApi<{ items: { id: string; at: string; event: string; channel: string; to: string; status: string; error: string }[]; total: number; page: number; limit: number }>(
    tab === "notifications" ? `/api/admin/notifications${qs({ page })}` : null,
  );
  const current = tab === "audit" ? audit : notes;

  return (
    <div>
      <PageHeader title="Activity log" description="Administrative changes and outbound notification delivery." />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        tabs={[
          { id: "audit", label: "Audit trail" },
          { id: "notifications", label: "Notification delivery" },
        ]}
      />
      {tab === "audit" && <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} wrapClassName="mb-4 max-w-sm" />}
      {current.error && <ErrorState error={current.error} onRetry={current.reload} />}
      {current.loading && !current.data ? (
        <Spinner />
      ) : tab === "audit" ? (
        audit.data?.items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {audit.data.items.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(a.at)}</Td>
                  <Td>
                    {a.actor} <span className="text-xs capitalize text-stone">({a.role})</span>
                  </Td>
                  <Td className="font-mono text-xs">{a.action}</Td>
                  <Td>{a.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No activity yet" />
        )
      ) : notes.data?.items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Event</Th>
              <Th>Channel</Th>
              <Th>To</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {notes.data.items.map((n) => (
              <tr key={n.id}>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(n.at)}</Td>
                <Td>{n.event.replace(/_/g, " ")}</Td>
                <Td className="capitalize">{n.channel}</Td>
                <Td className="text-xs">{n.to}</Td>
                <Td>
                  <Badge className={n.status === "sent" ? "bg-[#eef5ef] text-success" : n.status === "failed" ? "bg-[#fbefec] text-danger" : "bg-cream text-stone"}>{n.status}</Badge>
                  {n.error && <span className="block text-xs text-stone">{n.error}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No outbound notifications yet" />
      )}
      {current.data && <Pagination page={current.data.page} total={current.data.total} limit={current.data.limit} onPage={setPage} />}
    </div>
  );
}
