import { api, json } from "@/server/lib/http";
import { requireUser } from "@/server/auth/session";
import { Notification } from "@/server/models";

export const GET = api(async () => {
  const user = await requireUser();
  const items = await Notification.find({ userId: user.id, channel: "inapp" }).sort({ createdAt: -1 }).limit(30).lean();
  return json({
    notifications: items.map((n) => ({ id: String(n._id), subject: n.subject, body: n.body, link: n.link, at: n.createdAt, read: !!n.readAt })),
    unread: items.filter((n) => !n.readAt).length,
  });
});

export const POST = api(async () => {
  const user = await requireUser();
  await Notification.updateMany({ userId: user.id, channel: "inapp", readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return json({ ok: true });
});
