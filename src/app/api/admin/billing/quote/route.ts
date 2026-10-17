import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { quoteInvoice } from "@/server/services/billing";
import { parseBillInput } from "@/server/services/bill-input";
import { staffNameMap } from "@/server/services/booking";
import { getSettings } from "@/server/services/settings";

/**
 * Live price check for the billing screen: the exact calculation used when the bill is finalized
 * (catalogue prices, membership, coupon, manual discount, loyalty, tax), with nothing saved or claimed.
 */
export const POST = api(async (req) => {
  const user = await requirePermission("billing.manage");
  const body = await readJson(req);
  const [q, settings] = await Promise.all([quoteInvoice(await parseBillInput(body, { requireCustomer: false }), user), getSettings()]);
  const names = await staffNameMap(q.lines.flatMap((l) => l.allocations ?? []).map((a) => a.staffId));
  return json({
    customer: q.customer,
    lines: q.lines.map((l) => ({
      kind: l.kind,
      refId: l.refId ? String(l.refId) : null,
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      amount: l.amount,
      discount: l.discount ?? 0,
      taxable: l.taxable,
      allocations: (l.allocations ?? []).map((a) => ({ staffId: String(a.staffId), percent: a.percent, name: names.get(String(a.staffId)) ?? "" })),
    })),
    discounts: q.discounts.map((d) => ({ kind: d.kind, code: d.code ?? null, description: d.description, amount: d.amount })),
    totals: q.totals,
    tax: q.tax,
    membership: q.membership,
    // What the payment step may offer.
    payments: {
      cash: !!settings.payments?.cash,
      upi: !!settings.payments?.upi,
      card: !!settings.payments?.card,
      upiId: settings.payments?.upiId ?? "",
      allowPartial: settings.billing?.allowPartialPayment !== false,
    },
  });
});
