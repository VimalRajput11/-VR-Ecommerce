import { api, json, readJson } from "@/server/lib/http";
import { objectId } from "@/server/lib/validate";
import { notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { JobOpening, type JobOpeningDoc } from "@/server/models";
import { parseOpening, serialiseOpening } from "@/server/services/careers";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("careers.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const update = parseOpening(body, true);
  if (body.archived === false) update.archived = false;
  const opening = await JobOpening.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean<JobOpeningDoc>();
  if (!opening) throw notFound("Job opening not found.");
  await audit(user, "careers.opening_update", "JobOpening", String(id), `Updated job: ${opening.title}`);
  return json({ opening: serialiseOpening(opening) });
});

/** Openings are archived (not deleted) so past applications keep their context. */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("careers.manage");
  const id = objectId((await ctx.params).id);
  const opening = await JobOpening.findByIdAndUpdate(id, { $set: { archived: true, active: false } }, { new: true }).lean();
  if (!opening) throw notFound("Job opening not found.");
  await audit(user, "careers.opening_archive", "JobOpening", String(id), `Archived job: ${opening.title}`);
  return json({ ok: true });
});
