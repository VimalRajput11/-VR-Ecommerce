import type { Types } from "mongoose";
import { InventoryMovement, Product, Service } from "@/server/models";
import { badRequest, conflict, notFound } from "@/server/lib/errors";

type MovementType = "received" | "consumed" | "sold" | "adjustment" | "returned";

interface Adjust {
  productId: Types.ObjectId | string;
  delta: number;
  type: MovementType;
  reason?: string;
  by?: string;
  unitCost?: number;
  appointmentId?: Types.ObjectId;
  invoiceId?: Types.ObjectId;
  /** Sales must not oversell; consumption is recorded even if the count goes negative. */
  allowNegative?: boolean;
}

export async function adjustStock(a: Adjust) {
  if (!Number.isFinite(a.delta) || a.delta === 0) throw badRequest("Quantity must not be zero.", "qty");
  const filter: Record<string, unknown> = { _id: a.productId };
  if (a.delta < 0 && !a.allowNegative) filter.quantity = { $gte: -a.delta };
  const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: a.delta } }, { new: true });
  if (!product) {
    const exists = await Product.exists({ _id: a.productId });
    if (!exists) throw notFound("Product not found.");
    throw conflict("Not enough stock for this change.");
  }
  await InventoryMovement.create({
    productId: product._id,
    type: a.type,
    qty: a.delta,
    balanceAfter: product.quantity,
    unitCost: a.unitCost,
    reason: a.reason,
    appointmentId: a.appointmentId,
    invoiceId: a.invoiceId,
    by: a.by,
  });
  return product;
}

/** Record supplies used by a completed appointment's services. */
export async function consumeForServices(serviceIds: Types.ObjectId[], appointmentId: Types.ObjectId, by?: string) {
  const services = await Service.find({ _id: { $in: serviceIds } }).select("name consumes").lean();
  for (const service of services) {
    for (const use of service.consumes ?? []) {
      if (!use.qty) continue;
      try {
        await adjustStock({
          productId: use.productId,
          delta: -use.qty,
          type: "consumed",
          reason: `Used for ${service.name}`,
          appointmentId,
          by,
          allowNegative: true,
        });
      } catch (err) {
        console.error("[inventory] consumption failed", err);
      }
    }
  }
}
