import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

// Point-of-sale records that sit alongside invoices. All money is integer paise.

/**
 * A bill saved before it is finalized ("Save" on the billing screen). It only stores what the
 * operator chose; prices, discounts and totals are always recalculated by the server.
 * `version` guards against two people overwriting the same draft.
 */
const billDraftSchema = new Schema(
  {
    number: { type: String, required: true, unique: true }, // D-0001
    status: { type: String, enum: ["open", "finalizing", "finalized", "discarded"], default: "open", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    customer: { name: String, phone: String, email: String },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    payload: { type: Schema.Types.Mixed, required: true }, // the bill's selections (validated on finalize)
    previewTotal: { type: Number, default: 0 }, // last calculated total, for the open-bills list only
    itemCount: { type: Number, default: 0 },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
billDraftSchema.index({ status: 1, updatedAt: -1 });

const makeDraft = () => model("BillDraft", billDraftSchema);
export const BillDraft = (models.BillDraft as ReturnType<typeof makeDraft>) ?? makeDraft();
export type BillDraftDoc = InferSchemaType<typeof billDraftSchema> & { _id: Types.ObjectId };

/**
 * Customer advance (prepaid credit) ledger. The balance lives on User.advanceBalance and every
 * change writes one of these with the balance before and after, so it can always be audited.
 */
const advanceTxSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["deposit", "redeem", "refund", "reversal"], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    method: { type: String }, // how a deposit was paid / how a refund was given
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
advanceTxSchema.index({ customerId: 1, createdAt: -1 });
// One redemption per invoice payment record, so a retried request can't deduct twice.
advanceTxSchema.index({ invoiceId: 1, type: 1, amount: 1, createdAt: 1 });

const makeAdvanceTx = () => model("AdvanceTransaction", advanceTxSchema);
export const AdvanceTransaction = (models.AdvanceTransaction as ReturnType<typeof makeAdvanceTx>) ?? makeAdvanceTx();
export type AdvanceTxDoc = InferSchemaType<typeof advanceTxSchema> & { _id: Types.ObjectId };

/** Gift card sold at the counter (as a bill line) and redeemable as a payment method. */
const giftCardSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    initialValue: { type: Number, required: true, min: 1 },
    balance: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
    purchaserId: { type: Schema.Types.ObjectId, ref: "User" },
    soldInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

const makeGiftCard = () => model("GiftCard", giftCardSchema);
export const GiftCard = (models.GiftCard as ReturnType<typeof makeGiftCard>) ?? makeGiftCard();
export type GiftCardDoc = InferSchemaType<typeof giftCardSchema> & { _id: Types.ObjectId };

const giftCardTxSchema = new Schema(
  {
    giftCardId: { type: Schema.Types.ObjectId, ref: "GiftCard", required: true, index: true },
    type: { type: String, enum: ["issue", "redeem", "refund", "adjust"], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const makeGiftCardTx = () => model("GiftCardTransaction", giftCardTxSchema);
export const GiftCardTransaction = (models.GiftCardTransaction as ReturnType<typeof makeGiftCardTx>) ?? makeGiftCardTx();

/** A membership the salon sells, e.g. "Gold – 1 year – 15% off services". */
const membershipPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    servicePercent: { type: Number, default: 0, min: 0, max: 100 },
    productPercent: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, maxlength: 400 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const makePlan = () => model("MembershipPlan", membershipPlanSchema);
export const MembershipPlan = (models.MembershipPlan as ReturnType<typeof makePlan>) ?? makePlan();
export type MembershipPlanDoc = InferSchemaType<typeof membershipPlanSchema> & { _id: Types.ObjectId };

/** A customer's membership, copied from the plan at the time of sale so later plan edits don't change it. */
const customerMembershipSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "MembershipPlan" },
    name: { type: String, required: true },
    servicePercent: { type: Number, default: 0 },
    productPercent: { type: Number, default: 0 },
    startsOn: { type: String, required: true }, // YYYY-MM-DD (IST)
    endsOn: { type: String, required: true },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
  },
  { timestamps: true },
);
customerMembershipSchema.index({ customerId: 1, status: 1, endsOn: -1 });

const makeCustomerMembership = () => model("CustomerMembership", customerMembershipSchema);
export const CustomerMembership = (models.CustomerMembership as ReturnType<typeof makeCustomerMembership>) ?? makeCustomerMembership();
export type CustomerMembershipDoc = InferSchemaType<typeof customerMembershipSchema> & { _id: Types.ObjectId };
