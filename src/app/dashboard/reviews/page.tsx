"use client";

import { useState } from "react";
import { apiFetch, qs, useApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { RequirePermission } from "@/components/dashboard/DashboardShell";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner, Tabs, Textarea } from "@/components/ui";
import Stars from "@/components/site/Stars";
import { formatDate } from "@/lib/time";

interface R {
  id: string;
  name: string;
  rating: number;
  comment: string;
  services: string[];
  status: string;
  reply: string;
  at: string;
}

export default function ReviewsAdminPage() {
  return (
    <RequirePermission any={["reviews.moderate"]}>
      <ReviewsAdmin />
    </RequirePermission>
  );
}

function ReviewsAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<{ items: R[]; total: number; page: number; limit: number }>(`/api/admin/reviews${qs({ status, page })}`);
  const [replies, setReplies] = useState<Record<string, string>>({});

  async function update(r: R, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/admin/reviews/${r.id}`, { method: "PATCH", body });
      toast(msg);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader title="Reviews" description="Reviews come only from customers with completed appointments. Approve them to publish on the website." />
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        tabs={[
          { id: "pending", label: "Pending" },
          { id: "approved", label: "Published" },
          { id: "rejected", label: "Hidden" },
        ]}
      />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="Nothing here" />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-lg border border-beige bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Stars rating={r.rating} />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-stone">{formatDate(r.at)}</span>
                </div>
                <Badge>{r.services.join(", ")}</Badge>
              </div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              <Textarea label="Public reply (optional)" rows={2} wrapClassName="mt-3" value={replies[r.id] ?? r.reply} onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })} />
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "approved" && (
                  <Button size="sm" onClick={() => update(r, { status: "approved", reply: replies[r.id] ?? r.reply }, "Review published")}>
                    Publish
                  </Button>
                )}
                {r.status !== "rejected" && (
                  <Button size="sm" variant="secondary" onClick={() => update(r, { status: "rejected" }, "Review hidden")}>
                    Hide
                  </Button>
                )}
                {replies[r.id] !== undefined && replies[r.id] !== r.reply && (
                  <Button size="sm" variant="ghost" onClick={() => update(r, { reply: replies[r.id] }, "Reply saved")}>
                    Save reply
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
