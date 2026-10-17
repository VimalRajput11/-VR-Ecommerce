import { int, optStr, str } from "@/server/lib/validate";
import type { MembershipPlanDoc } from "@/server/models";

export function serialisePlan(p: MembershipPlanDoc) {
  return {
    id: String(p._id),
    name: p.name,
    price: p.price,
    durationDays: p.durationDays,
    servicePercent: p.servicePercent ?? 0,
    productPercent: p.productPercent ?? 0,
    description: p.description ?? "",
    active: p.active !== false,
  };
}

export function parsePlan(body: Record<string, unknown>) {
  return {
    name: str(body, "name", { max: 80, label: "Plan name" }),
    price: int(body, "price", { min: 0, max: 100_000_000, label: "Price" }),
    durationDays: int(body, "durationDays", { min: 1, max: 3650, label: "Duration" }),
    servicePercent: int(body, "servicePercent", { min: 0, max: 100, label: "Service discount" }),
    productPercent: int(body, "productPercent", { min: 0, max: 100, label: "Product discount" }),
    description: optStr(body, "description", { max: 400 }) ?? "",
    active: body.active !== false,
  };
}
