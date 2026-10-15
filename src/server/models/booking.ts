import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { APPOINTMENT_STATUSES } from "@/lib/constants";

const itemSchema = new Schema(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    name: { type: String, required: true },
    kind: { type: String, default: "service" },
    durationMin: { type: Number, required: true },
    price: { type: Number, required: true }, // paise, snapshot at booking time
    priceVerified: { type: Boolean, default: true },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: String,
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    ref: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: {
      type: new Schema(
        { name: { type: String, required: true }, phone: { type: String, required: true }, email: String },
        { _id: false },
      ),
      required: true,
    },
    items: { type: [itemSchema], validate: (v: unknown[]) => v.length > 0 },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    durationMin: { type: Number, required: true },
    bufferMin: { type: Number, default: 0 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "pending" },
    source: { type: String, enum: ["online", "walk_in", "phone", "staff"], default: "online" },
    paymentPreference: { type: String, enum: ["pay_at_salon", "online"], default: "pay_at_salon" },
    estimatedTotal: { type: Number, required: true },
    customerNotes: { type: String, maxlength: 500 },
    internalNotes: { type: String, maxlength: 2000 },
    serviceNotes: { type: String, maxlength: 2000 },
    history: { type: [historySchema], default: [] },
    request: {
      type: { type: String, enum: ["cancel", "reschedule"] },
      reason: { type: String, maxlength: 500 },
      preferredTime: { type: String, maxlength: 200 },
      at: Date,
      resolved: { type: Boolean, default: false },
    },
    checkedInAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    reviewed: { type: Boolean, default: false },
    reminderSentAt: Date,
    inventoryConsumed: { type: Boolean, default: false },
    idempotencyKey: { type: String, maxlength: 100 },
  },
  { timestamps: true },
);
appointmentSchema.index({ staffId: 1, start: 1 });
appointmentSchema.index({ start: 1, status: 1 });
appointmentSchema.index({ customerId: 1, start: -1 });
appointmentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

const makeAppointment = () => model("Appointment", appointmentSchema);
export const Appointment = (models.Appointment as ReturnType<typeof makeAppointment>) ?? makeAppointment();
export type AppointmentDoc = InferSchemaType<typeof appointmentSchema> & { _id: Types.ObjectId };

// One document per 5-minute block a stylist is booked for. The unique index makes double
// booking impossible even when two requests race, without needing multi-document transactions.
const slotLockSchema = new Schema({
  resourceId: { type: Schema.Types.ObjectId, required: true },
  slot: { type: Date, required: true },
  appointmentId: { type: Schema.Types.ObjectId, required: true, index: true },
});
slotLockSchema.index({ resourceId: 1, slot: 1 }, { unique: true });

const makeSlotLock = () => model("SlotLock", slotLockSchema);
export const SlotLock = (models.SlotLock as ReturnType<typeof makeSlotLock>) ?? makeSlotLock();

// Holidays / closures (staffId null) and staff leave / blocked time.
const timeOffSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    kind: { type: String, enum: ["holiday", "closure", "leave", "block"], default: "block" },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reason: { type: String, maxlength: 200 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
timeOffSchema.index({ staffId: 1, start: 1, end: 1 });

const makeTimeOff = () => model("TimeOff", timeOffSchema);
export const TimeOff = (models.TimeOff as ReturnType<typeof makeTimeOff>) ?? makeTimeOff();
export type TimeOffDoc = InferSchemaType<typeof timeOffSchema> & { _id: Types.ObjectId };
