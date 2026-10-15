import { badRequest } from "@/server/lib/errors";
import { bool, clearableStr, int, isoDate, objectIdArray, oneOf, optInt, str } from "@/server/lib/validate";
import type { CouponDoc } from "@/server/models";

export function parseCoupon(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || "code" in body) out.code = str(body, "code", { max: 30, pattern: /^[A-Za-z0-9_-]+$/, label: "Code" }).toUpperCase();
  if (!partial || "title" in body) out.title = str(body, "title", { max: 120, label: "Title" });
  const description = clearableStr(body, "description", { max: 500 });
  if (description !== undefined) out.description = description;
  if (!partial || "kind" in body) out.kind = oneOf(body, "kind", ["seasonal", "festival", "first_visit", "referral", "general"] as const);
  if (!partial || "type" in body) out.type = oneOf(body, "type", ["percent", "flat"] as const);
  if (!partial || "value" in body) {
    out.value = int(body, "value", { min: 1, max: 100_000_000, label: "Value" });
    if ((out.type ?? body.type) === "percent" && (out.value as number) > 100) throw badRequest("Percentage cannot exceed 100.", "value");
  }
  for (const f of ["maxDiscount", "minSubtotal", "maxRedemptions"] as const) {
    const v = optInt(body, f, { min: 0, max: 100_000_000 });
    if (v !== undefined) out[f] = v;
  }
  const per = optInt(body, "perCustomerLimit", { min: 1, max: 1000 });
  if (per !== undefined) out.perCustomerLimit = per;
  if (!partial || "startsAt" in body) out.startsAt = isoDate(body.startsAt, "startsAt");
  if (!partial || "endsAt" in body) out.endsAt = isoDate(body.endsAt, "endsAt");
  if (out.startsAt && out.endsAt && (out.endsAt as Date) <= (out.startsAt as Date)) throw badRequest("End date must be after start date.", "endsAt");
  for (const f of ["firstVisitOnly", "showOnWebsite", "active"] as const) {
    const v = bool(body, f);
    if (v !== undefined) out[f] = v;
  }
  if (out.kind === "first_visit") out.firstVisitOnly = true;
  if ("serviceIds" in body) out.serviceIds = objectIdArray(body, "serviceIds", { max: 100 });
  return out;
}

export function serialiseCoupon(c: CouponDoc) {
  return {
    id: String(c._id),
    code: c.code,
    title: c.title,
    description: c.description ?? "",
    kind: c.kind,
    type: c.type,
    value: c.value,
    maxDiscount: c.maxDiscount ?? 0,
    minSubtotal: c.minSubtotal ?? 0,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    maxRedemptions: c.maxRedemptions ?? 0,
    perCustomerLimit: c.perCustomerLimit ?? 1,
    redemptions: c.redemptions ?? 0,
    firstVisitOnly: !!c.firstVisitOnly,
    serviceIds: (c.serviceIds ?? []).map(String),
    showOnWebsite: !!c.showOnWebsite,
    active: c.active !== false,
  };
}
