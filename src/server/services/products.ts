import { bool, clearableStr, optInt, optStr, str } from "@/server/lib/validate";
import type { ProductDoc } from "@/server/models";

export function parseProduct(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || "name" in body) out.name = str(body, "name", { max: 120, label: "Product name" });
  const category = optStr(body, "category", { max: 60 });
  if (category) out.category = category;
  const sku = clearableStr(body, "sku", { max: 40 });
  if (sku !== undefined) out.sku = sku;
  const unit = optStr(body, "unit", { max: 20 });
  if (unit) out.unit = unit;
  for (const f of ["costPrice", "sellingPrice", "lowStockThreshold"] as const) {
    const v = partial ? optInt(body, f, { min: 0, max: 100_000_000 }) : (optInt(body, f, { min: 0, max: 100_000_000 }) ?? 0);
    if (v !== undefined) out[f] = v;
  }
  for (const f of ["retail", "active"] as const) {
    const v = bool(body, f);
    if (v !== undefined) out[f] = v;
  }
  if (body.supplier && typeof body.supplier === "object") {
    const s = body.supplier as Record<string, unknown>;
    out.supplier = {
      name: optStr(s, "name", { max: 120 }) ?? "",
      phone: optStr(s, "phone", { max: 20 }) ?? "",
      notes: optStr(s, "notes", { max: 300 }) ?? "",
    };
  }
  return out;
}

export function serialiseProduct(p: ProductDoc) {
  return {
    id: String(p._id),
    name: p.name,
    category: p.category ?? "",
    sku: p.sku ?? "",
    unit: p.unit ?? "pcs",
    quantity: p.quantity ?? 0,
    costPrice: p.costPrice ?? 0,
    sellingPrice: p.sellingPrice ?? 0,
    retail: !!p.retail,
    lowStockThreshold: p.lowStockThreshold ?? 0,
    lowStock: (p.lowStockThreshold ?? 0) > 0 && (p.quantity ?? 0) <= (p.lowStockThreshold ?? 0),
    supplier: { name: p.supplier?.name ?? "", phone: p.supplier?.phone ?? "", notes: p.supplier?.notes ?? "" },
    active: p.active !== false,
  };
}
