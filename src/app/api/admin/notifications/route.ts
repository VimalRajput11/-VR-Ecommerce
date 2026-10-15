import { api, json } from "@/server/lib/http";
import { pagination } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { Notification } from "@/server/models";

/** Delivery log for outbound notifications, so failures and skipped channels are visible. */
export const GET = api(async (req) => {
  await requirePermission("settings.manage");
  const p = req.nextUrl.searchParams;
  const filter = { channel: { $ne: "inapp" } };
  const { skip, limit, page } = pagination(p, 50);
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return json({
    items: items.map((n) => ({ id: String(n._id), at: n.createdAt, event: n.event, channel: n.channel, to: n.to, status: n.status, error: n.error ?? "" })),
    total,
    page,
    limit,
  });
});
