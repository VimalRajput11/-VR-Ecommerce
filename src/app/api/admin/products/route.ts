import { api, json, readJson } from "@/server/lib/http";
import { requirePermission } from "@/server/auth/session";
import { Product } from "@/server/models";
import { parseProduct, serialiseProduct } from "@/server/services/products";
import { adjustStock } from "@/server/services/inventory";
import { audit } from "@/server/services/audit";

export const GET = api(async (req) => {
  await requirePermission("inventory.manage", "billing.manage");
  const retailOnly = req.nextUrl.searchParams.get("retail") === "1";
  const products = await Product.find(retailOnly ? { retail: true, active: true } : {}).sort({ active: -1, name: 1 }).limit(500).lean();
  return json({ products: products.map(serialiseProduct) });
});

export const POST = api(async (req) => {
  const user = await requirePermission("inventory.manage");
  const body = await readJson(req);
  const data = parseProduct(body, false);
  const openingQty = Number.isInteger(body.openingQty) && (body.openingQty as number) > 0 ? (body.openingQty as number) : 0;
  const product = await Product.create({ ...data, quantity: 0 });
  if (openingQty) await adjustStock({ productId: product._id, delta: openingQty, type: "received", reason: "Opening stock", by: user.id, unitCost: product.costPrice });
  await audit(user, "product.create", "Product", String(product._id), `Added product ${product.name}`);
  const fresh = await Product.findById(product._id).lean();
  return json({ product: serialiseProduct(fresh!) }, 201);
});
