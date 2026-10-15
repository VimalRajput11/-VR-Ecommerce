import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { JobApplication, JobOpening, type JobOpeningDoc } from "@/server/models";
import { parseOpening, serialiseOpening } from "@/server/services/careers";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  await requirePermission("careers.manage");
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const [openings, counts] = await Promise.all([
    JobOpening.find(includeArchived ? {} : { archived: { $ne: true } }).sort({ active: -1, order: 1, createdAt: -1 }).lean<JobOpeningDoc[]>(),
    JobApplication.aggregate([{ $group: { _id: { opening: "$openingId", status: "$status" }, n: { $sum: 1 } } }]),
  ]);
  const byOpening = new Map<string, { total: number; new: number }>();
  for (const c of counts) {
    const key = c._id.opening ? String(c._id.opening) : "general";
    const row = byOpening.get(key) ?? { total: 0, new: 0 };
    row.total += c.n;
    if (c._id.status === "new") row.new += c.n;
    byOpening.set(key, row);
  }
  return json({
    openings: openings.map((o) => ({ ...serialiseOpening(o), applications: byOpening.get(String(o._id)) ?? { total: 0, new: 0 } })),
    general: byOpening.get("general") ?? { total: 0, new: 0 },
  });
});

export const POST = api(async (req) => {
  const user = await requirePermission("careers.manage");
  const opening = await JobOpening.create(parseOpening(await readJson(req), false));
  await audit(user, "careers.opening_create", "JobOpening", String(opening._id), `Posted job: ${opening.title}`);
  return json({ opening: serialiseOpening(opening.toObject() as JobOpeningDoc) }, 201);
});
