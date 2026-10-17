import { api, json, readJson } from "@/server/lib/http";
import { int, objectId } from "@/server/lib/validate";
import { conflict, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { BillDraft, type BillDraftDoc } from "@/server/models";
import { parseBillInput } from "@/server/services/bill-input";
import { saveDraft, serialiseDraft } from "@/server/services/pos";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, ctx) => {
  await requirePermission("billing.manage");
  const draft = await BillDraft.findById(objectId((await ctx.params).id)).lean<BillDraftDoc>();
  if (!draft) throw notFound("Saved bill not found.");
  return json({ draft: serialiseDraft(draft) });
});

/** Update a saved bill. `version` must match, so one person can't silently overwrite another's changes. */
export const PUT = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("billing.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const version = int(body, "version", { min: 1, max: 1_000_000, label: "Version" });
  const input = await parseBillInput(body, { requireCustomer: false });
  const draft = await saveDraft(body, input, user, { id, version });
  return json({ draft: serialiseDraft(draft) });
});

/** Discard a saved bill. Only open drafts; finalized invoices are never deleted here. */
export const DELETE = api<Ctx>(async (_req, ctx) => {
  const user = await requirePermission("billing.manage");
  const id = objectId((await ctx.params).id);
  const draft = await BillDraft.findOneAndUpdate({ _id: id, status: "open" }, { $set: { status: "discarded", updatedBy: user.id } }, { new: true }).lean();
  if (!draft) {
    if (!(await BillDraft.exists({ _id: id }))) throw notFound("Saved bill not found.");
    throw conflict("Only open bills can be discarded.");
  }
  await audit(user, "draft.discard", "BillDraft", String(id), `Discarded saved bill ${draft.number}`);
  return json({ ok: true });
});
