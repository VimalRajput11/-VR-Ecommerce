import { api, json } from "@/server/lib/http";
import { pagination } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { ContactMessage } from "@/server/models";

export const GET = api(async (req) => {
  await requirePermission("messages.view");
  const p = req.nextUrl.searchParams;
  const status = p.get("status");
  const filter = status && ["new", "in_progress", "resolved"].includes(status) ? { status } : {};
  const { skip, limit, page } = pagination(p, 25);
  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  return json({
    items: items.map((m) => ({ id: String(m._id), name: m.name, phone: m.phone ?? "", email: m.email ?? "", subject: m.subject ?? "", message: m.message, status: m.status, notes: m.notes ?? "", at: m.createdAt })),
    total,
    page,
    limit,
  });
});
