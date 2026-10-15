import { api, json, readJson } from "@/server/lib/http";
import { clearableStr, objectId, oneOf } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { JobApplication, APPLICATION_STATUSES, type JobApplicationDoc } from "@/server/models";
import { serialiseApplication } from "@/server/services/careers";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("careers.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const set: Record<string, unknown> = {};
  if ("status" in body) set.status = oneOf(body, "status", APPLICATION_STATUSES);
  const notes = clearableStr(body, "notes", { max: 2000 });
  if (notes !== undefined) set.notes = notes;
  const app = await JobApplication.findByIdAndUpdate(id, { $set: set }, { new: true }).lean<JobApplicationDoc>();
  if (!app) throw notFound("Application not found.");
  if (set.status) await audit(user, "careers.application_status", "JobApplication", String(id), `${app.name} (${app.position}) → ${app.status}`);
  return json({ application: serialiseApplication(app) });
});

/** Permanently removes an applicant's personal data (e.g. on request). */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("careers.manage");
  const id = objectId((await ctx.params).id);
  const app = await JobApplication.findByIdAndDelete(id).lean();
  if (!app) throw notFound("Application not found.");
  await audit(user, "careers.application_delete", "JobApplication", String(id), `Deleted application from ${app.name} (${app.position})`);
  return json({ ok: true });
});
