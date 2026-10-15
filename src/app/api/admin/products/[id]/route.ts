import { api, json, readJson } from "@/server/lib/http";
import { int, objectId, oneOf, optStr } from "@/server/lib/validate";
import { badRequest, notFound } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/session";
import { InventoryMovement, Product } from "@/server/models";
import { parseProduct, serialiseProduct } from "@/server/services/products";
import { adjustStock } from "@/server/services/inventory";
import { audit } from "@/server/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api<Ctx>(async (_req, ctx) => {
  await requirePermission("inventory.manage");
  const id = objectId((await ctx.params).id);
  const product = await Product.findById(id).lean();
  if (!product) throw notFound("Product not found.");
  const movements = await InventoryMovement.find({ productId: id }).sort({ createdAt: -1 }).limit(100).lean();
  return json({
    product: serialiseProduct(product),
    movements: movements.map((m) => ({ id: String(m._id), type: m.type, qty: m.qty, balanceAfter: m.balanceAfter, reason: m.reason ?? "", at: m.createdAt })),
  });
});

export const PATCH = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("inventory.manage");
  const id = objectId((await ctx.params).id);
  const product = await Product.findByIdAndUpdate(id, { $set: parseProduct(await readJson(req), true) }, { new: true, runValidators: true }).lean();
  if (!product) throw notFound("Product not found.");
  await audit(user, "product.update", "Product", String(id), `Updated product ${product.name}`);
  return json({ product: serialiseProduct(product) });
});

/** Stock movements: receive stock, record use, or adjust with a reason. */
export const POST = api<Ctx>(async (req, ctx) => {
  const user = await requirePermission("inventory.manage");
  const id = objectId((await ctx.params).id);
  const body = await readJson(req);
  const type = oneOf(body, "type", ["received", "consumed", "adjustment"] as const);
  const qty = int(body, "qty", { min: -100_000, max: 100_000, label: "Quantity" });
  if (qty === 0) throw badRequest("Quantity cannot be zero.", "qty");
  const reason = optStr(body, "reason", { max: 300 });
  if (type === "adjustment" && !reason) throw badRequest("Please give a reason for the adjustment.", "reason");
  const delta = type === "received" ? Math.abs(qty) : type === "consumed" ? -Math.abs(qty) : qty;
  const product = await adjustStock({ productId: id, delta, type, reason, by: user.id, allowNegative: false });
  await audit(user, `stock.${type}`, "Product", String(id), `${product.name}: ${delta > 0 ? "+" : ""}${delta} (${reason ?? type})`);
  return json({ product: serialiseProduct(product.toObject()) });
});
