import { api, json } from "@/server/lib/http";
import { escapeRegex, pagination } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { AuditLog } from "@/server/models";

export const GET = api(async (req) => {
  await requirePermission("audit.view");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};
  const q = p.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
    filter.$or = [{ summary: rx }, { action: rx }, { actorName: rx }];
  }
  const { skip, limit, page } = pagination(p, 50);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return json({
    items: items.map((a) => ({ id: String(a._id), at: a.createdAt, actor: a.actorName, role: a.actorRole, action: a.action, entity: a.entity, summary: a.summary })),
    total,
    page,
    limit,
  });
});
