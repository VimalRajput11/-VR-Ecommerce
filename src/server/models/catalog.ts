import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { SERVICE_AUDIENCES } from "@/lib/constants";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, maxlength: 80 },
    description: { type: String, maxlength: 400 },
    image: { type: String, maxlength: 500 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const makeCategory = () => model("ServiceCategory", categorySchema);
export const ServiceCategory = (models.ServiceCategory as ReturnType<typeof makeCategory>) ?? makeCategory();
export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: Types.ObjectId };

const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, maxlength: 120 },
    categoryId: { type: Schema.Types.ObjectId, ref: "ServiceCategory", required: true, index: true },
    kind: { type: String, enum: ["service", "package", "addon"], default: "service" },
    audience: { type: String, enum: SERVICE_AUDIENCES, default: "unisex" },
    description: { type: String, maxlength: 1500 },
    durationMin: { type: Number, required: true, min: 5, max: 720 },
    bufferMin: { type: Number, default: 0, min: 0, max: 120 },
    price: { type: Number, required: true, min: 0 }, // paise
    priceFrom: { type: Boolean, default: false }, // "starting from" pricing
    // Prices must be verified by the owner before they are shown publicly.
    priceVerified: { type: Boolean, default: false },
    taxable: { type: Boolean, default: true },
    includes: [{ type: Schema.Types.ObjectId, ref: "Service" }], // package contents
    eligibleStaff: [{ type: Schema.Types.ObjectId, ref: "User" }], // empty = any bookable stylist
    consumes: [
      {
        _id: false,
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true, min: 0 },
      },
    ],
    image: { type: String, maxlength: 500 },
    featured: { type: Boolean, default: false },
    onlineBooking: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
serviceSchema.index({ active: 1, archived: 1, categoryId: 1, order: 1 });

const makeService = () => model("Service", serviceSchema);
export const Service = (models.Service as ReturnType<typeof makeService>) ?? makeService();
export type ServiceDoc = InferSchemaType<typeof serviceSchema> & { _id: Types.ObjectId };
