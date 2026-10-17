import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

// Owner-only staff pay records. Kept out of the User document so salary details never travel
// with staff profiles that receptionists and stylists can read.

/** Pay terms for one employee. Amounts are in paise. */
const payProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    monthlySalary: { type: Number, default: 0, min: 0 },
    commissionPercent: { type: Number, default: 0, min: 0, max: 100 },
    joinedOn: { type: String, maxlength: 10 }, // YYYY-MM-DD
    paymentDetails: { type: String, maxlength: 300, default: "" }, // UPI ID / bank account for salary transfers
    notes: { type: String, maxlength: 1000, default: "" },
  },
  { timestamps: true },
);

const makePayProfile = () => model("PayProfile", payProfileSchema);
export const PayProfile = (models.PayProfile as ReturnType<typeof makePayProfile>) ?? makePayProfile();
export type PayProfileDoc = InferSchemaType<typeof payProfileSchema> & { _id: Types.ObjectId };

export const PAY_ENTRY_TYPES = ["payment", "advance", "bonus", "deduction"] as const;
export type PayEntryType = (typeof PAY_ENTRY_TYPES)[number];

/**
 * One dated money record for an employee, counted in the salary month it belongs to:
 * payment (salary paid out), advance (paid early, deducted), bonus (added), deduction (e.g. leave).
 */
const payEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ }, // salary month, YYYY-MM
    type: { type: String, enum: PAY_ENTRY_TYPES, required: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: String, required: true, maxlength: 10 }, // YYYY-MM-DD the money moved
    method: { type: String, enum: ["cash", "upi", "bank", "other"], default: "cash" },
    note: { type: String, maxlength: 300, default: "" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
payEntrySchema.index({ userId: 1, month: 1 });
payEntrySchema.index({ month: 1 });

const makePayEntry = () => model("PayEntry", payEntrySchema);
export const PayEntry = (models.PayEntry as ReturnType<typeof makePayEntry>) ?? makePayEntry();
export type PayEntryDoc = InferSchemaType<typeof payEntrySchema> & { _id: Types.ObjectId };
