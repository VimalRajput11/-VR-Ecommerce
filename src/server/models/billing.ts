import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { PAYMENT_METHODS } from "@/lib/constants";

const lineSchema = new Schema(
  {
    kind: { type: String, enum: ["service", "product", "custom"], required: true },
    refId: { type: Schema.Types.ObjectId },
    description: { type: String, required: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxable: { type: Boolean, default: true },
  },
  { _id: false },
);

const discountSchema = new Schema(
  {
    kind: { type: String, enum: ["coupon", "manual", "loyalty"], required: true },
    code: String,
    description: { type: String, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    refId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    activeAppointmentKey: { type: Schema.Types.ObjectId },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: { name: String, phone: String, email: String },
    lines: { type: [lineSchema], validate: (v: unknown[]) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discounts: { type: [discountSchema], default: [] },
    discountTotal: { type: Number, default: 0, min: 0 },
    tax: {
      name: String,
      rateBps: { type: Number, default: 0 },
      inclusive: { type: Boolean, default: false },
      amount: { type: Number, default: 0 },
    },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountRefunded: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "partially_refunded", "refunded", "void"],
      default: "unpaid",
    },
    notes: { type: String, maxlength: 500 },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: String,
    loyaltyAwarded: { type: Number, default: 0 },
    gatewayOrderId: String,
    // Random token for the public invoice link sent to customers on WhatsApp (/i/<token>).
    shareToken: { type: String },
  },
  { timestamps: true },
);
invoiceSchema.index({ shareToken: 1 }, { unique: true, partialFilterExpression: { shareToken: { $type: "string" } } });
// Set to appointmentId while the invoice is live and unset when voided, so an appointment can
// only ever have one live invoice.
invoiceSchema.index(
  { activeAppointmentKey: 1 },
  { unique: true, partialFilterExpression: { activeAppointmentKey: { $type: "objectId" } } },
);
invoiceSchema.index({ appointmentId: 1 });
invoiceSchema.index({ issuedAt: -1 });
invoiceSchema.index({ status: 1, issuedAt: -1 });

const makeInvoice = () => model("Invoice", invoiceSchema);
export const Invoice = (models.Invoice as ReturnType<typeof makeInvoice>) ?? makeInvoice();
export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { _id: Types.ObjectId };

const paymentSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    kind: { type: String, enum: ["payment", "refund"], required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 1 },
    reference: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 300 },
    gatewayPaymentId: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
paymentSchema.index({ createdAt: -1 });
// Each gateway payment can only be applied once (replayed webhooks are ignored).
paymentSchema.index(
  { gatewayPaymentId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: "string" } } },
);

const makePayment = () => model("Payment", paymentSchema);
export const Payment = (models.Payment as ReturnType<typeof makePayment>) ?? makePayment();
export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };

const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
const makeCounter = () => model("Counter", counterSchema);
export const Counter = (models.Counter as ReturnType<typeof makeCounter>) ?? makeCounter();

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 500 },
    kind: { type: String, enum: ["seasonal", "festival", "first_visit", "referral", "general"], default: "general" },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or paise
    maxDiscount: { type: Number, default: 0 }, // paise, 0 = no cap
    minSubtotal: { type: Number, default: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    maxRedemptions: { type: Number, default: 0 }, // 0 = unlimited
    perCustomerLimit: { type: Number, default: 1, min: 1 },
    redemptions: { type: Number, default: 0 },
    firstVisitOnly: { type: Boolean, default: false },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    showOnWebsite: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const makeCoupon = () => model("Coupon", couponSchema);
export const Coupon = (models.Coupon as ReturnType<typeof makeCoupon>) ?? makeCoupon();
export type CouponDoc = InferSchemaType<typeof couponSchema> & { _id: Types.ObjectId };

const couponRedemptionSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    amount: { type: Number, required: true },
    reversed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
couponRedemptionSchema.index({ couponId: 1, invoiceId: 1 }, { unique: true });
couponRedemptionSchema.index({ couponId: 1, customerId: 1 });

const makeRedemption = () => model("CouponRedemption", couponRedemptionSchema);
export const CouponRedemption = (models.CouponRedemption as ReturnType<typeof makeRedemption>) ?? makeRedemption();

const loyaltySchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    points: { type: Number, required: true },
    reason: { type: String, enum: ["earn", "redeem", "adjust", "reverse"], required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    note: { type: String, maxlength: 200 },
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const makeLoyalty = () => model("LoyaltyTransaction", loyaltySchema);
export const LoyaltyTransaction = (models.LoyaltyTransaction as ReturnType<typeof makeLoyalty>) ?? makeLoyalty();
