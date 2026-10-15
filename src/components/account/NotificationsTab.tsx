"use client";

import Link from "next/link";
import { apiFetch, useApi } from "@/lib/api";
import { Button, EmptyState, ErrorState, Spinner, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/time";

interface N {
  id: string;
  subject: string;
  body: string;
  link?: string;
  at: string;
  read: boolean;
}

export default function NotificationsTab() {
  const { data, error, loading, reload } = useApi<{ notifications: N[]; unread: number }>("/api/account/notifications");
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.notifications.length) return <EmptyState title="No notifications">Booking confirmations and updates will appear here.</EmptyState>;
  return (
    <div>
      {data.unread > 0 && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="secondary" onClick={async () => { await apiFetch("/api/account/notifications", { method: "POST" }); reload(); }}>
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {data.notifications.map((n) => (
          <li key={n.id} className={cx("rounded-lg border bg-white p-4", n.read ? "border-beige" : "border-gold")}>
            <div className="flex justify-between gap-3">
              <p className="font-medium">{n.subject}</p>
              <time className="whitespace-nowrap text-xs text-stone">{formatDateTime(n.at)}</time>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-stone">{n.body}</p>
            {n.link && (
              <Link href={n.link} className="mt-2 inline-block text-xs text-gold-deep underline">
                View
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
