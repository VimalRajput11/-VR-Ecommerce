import { api, csvResponse, json } from "@/server/lib/http";
import { escapeRegex, isObjectId, pagination } from "@/server/lib/validate";
import { requirePermission } from "@/server/auth/session";
import { JobApplication, APPLICATION_STATUSES, type JobApplicationDoc } from "@/server/models";
import { serialiseApplication } from "@/server/services/careers";
import { formatDate } from "@/lib/time";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  const user = await requirePermission("careers.manage");
  const p = req.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};
  const status = p.get("status");
  if (status && (APPLICATION_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const opening = p.get("opening");
  if (opening === "general") filter.openingId = null;
  else if (opening && isObjectId(opening)) filter.openingId = opening;
  const q = p.get("q")?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.slice(0, 60)), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { position: rx }, { city: rx }];
  }

  if (p.get("format") === "csv") {
    const rows = await JobApplication.find(filter).sort({ createdAt: -1 }).limit(5000).lean<JobApplicationDoc[]>();
    await audit(user, "careers.export", "JobApplication", undefined, `Exported ${rows.length} applications`);
    return csvResponse(`vg-applications-${Date.now()}.csv`, [
      ["Date", "Position", "Name", "Phone", "Email", "City", "Experience (years)", "Skills", "Link", "Status"],
      ...rows.map((a) => [
        formatDate((a as { createdAt?: Date }).createdAt ?? new Date()),
        a.position,
        a.name,
        a.phone,
        a.email ?? "",
        a.city ?? "",
        a.experienceYears ?? 0,
        a.skills ?? "",
        a.portfolioUrl ?? "",
        APPLICATION_STATUS_LABELS[a.status] ?? a.status,
      ]),
    ]);
  }

  const { page, limit, skip } = pagination(p, 25);
  const [items, total, newCount] = await Promise.all([
    JobApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<JobApplicationDoc[]>(),
    JobApplication.countDocuments(filter),
    JobApplication.countDocuments({ status: "new" }),
  ]);
  return json({ items: items.map(serialiseApplication), total, page, limit, newCount });
});
