import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { BillDraft, Invoice, type BillDraftDoc } from "@/server/models";
import { parseBillInput } from "@/server/services/bill-input";
import { saveDraft, serialiseDraft } from "@/server/services/pos";

/** Open bills: saved drafts waiting to be finalized, plus finalized bills with money still due. */
export const GET = api(async () => {
  await requirePermission("billing.manage");
  const [drafts, unpaid] = await Promise.all([
    BillDraft.find({ status: "open" }).sort({ updatedAt: -1 }).limit(50).lean<BillDraftDoc[]>(),
    Invoice.find({ status: { $in: ["unpaid", "partially_paid"] } }).sort({ issuedAt: -1 }).limit(50).select("number customer total balanceDue status issuedAt").lean(),
  ]);
  return json({
    drafts: drafts.map(serialiseDraft),
    unpaid: unpaid.map((i) => ({ id: String(i._id), number: i.number, customer: i.customer, total: i.total, balanceDue: i.balanceDue, status: i.status, issuedAt: i.issuedAt })),
    openCount: drafts.length,
  });
});

/** Save a new draft bill ("Save" on the billing screen). No payment is recorded. */
export const POST = api(async (req) => {
  const user = await requirePermission("billing.manage");
  const body = await readJson(req);
  const input = await parseBillInput(body, { requireCustomer: false });
  const draft = await saveDraft(body, input, user, {});
  return json({ draft: serialiseDraft(draft) }, 201);
});
