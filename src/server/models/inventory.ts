import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, trim: true, maxlength: 60, default: "Supplies" },
    sku: { type: String, trim: true, maxlength: 40 },
    unit: { type: String, trim: true, maxlength: 20, default: "pcs" },
    quantity: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0, min: 0 }, // paise
    sellingPrice: { type: Number, default: 0, min: 0 }, // paise, used when retail
    retail: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 0, min: 0 },
    supplier: {
      name: { type: String, maxlength: 120 },
      phone: { type: String, maxlength: 20 },
      notes: { type: String, maxlength: 300 },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ active: 1, name: 1 });

const makeProduct = () => model("Product", productSchema);
export const Product = (models.Product as ReturnType<typeof makeProduct>) ?? makeProduct();
export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };

const movementSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: ["received", "consumed", "sold", "adjustment", "returned"], required: true },
    qty: { type: Number, required: true }, // signed change in stock
    balanceAfter: Number,
    unitCost: Number,
    reason: { type: String, maxlength: 300 },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
movementSchema.index({ createdAt: -1 });

const makeMovement = () => model("InventoryMovement", movementSchema);
export const InventoryMovement = (models.InventoryMovement as ReturnType<typeof makeMovement>) ?? makeMovement();
