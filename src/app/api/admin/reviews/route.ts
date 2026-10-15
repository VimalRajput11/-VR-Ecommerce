import { api, json } from "@/server/lib/http";
import { pagination } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { Review } from "@/server/models";

export const GET = api(async (req) => {
  await requirePermission("reviews.moderate");
  const p = req.nextUrl.searchParams;
  const status = p.get("status");
  const filter = status && ["pending", "approved", "rejected"].includes(status) ? { status } : {};
  const { skip, limit, page } = pagination(p, 25);
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  return json({
    items: items.map((r) => ({
      id: String(r._id),
      appointmentId: String(r.appointmentId),
      name: r.displayName,
      rating: r.rating,
      comment: r.comment ?? "",
      services: r.services ?? [],
      status: r.status,
      reply: r.reply ?? "",
      at: r.createdAt,
    })),
    total,
    page,
    limit,
  });
});
