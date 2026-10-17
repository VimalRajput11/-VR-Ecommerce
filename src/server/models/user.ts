import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { ROLES } from "@/lib/constants";

const dayHoursSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    closed: { type: Boolean, default: false },
    open: { type: String, default: "10:00" },
    close: { type: String, default: "20:00" },
  },
  { _id: false },
);

const breakSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ROLES, default: "customer", index: true },
    // Guest profiles are created for bookings made without an account.
    isGuest: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    extraPermissions: { type: [String], default: [] },

    staff: {
      title: { type: String, maxlength: 80 },
      bio: { type: String, maxlength: 600 },
      bookable: { type: Boolean, default: false },
      // Services this person performs. Empty = all services.
      services: [{ type: Schema.Types.ObjectId, ref: "Service" }],
      // Empty = follow salon opening hours.
      workingHours: { type: [dayHoursSchema], default: [] },
      breaks: { type: [breakSchema], default: [] },
      color: { type: String, maxlength: 20 },
    },

    preferences: { type: String, maxlength: 1000 },
    birthday: { type: String, maxlength: 10 }, // YYYY-MM-DD (year may be a placeholder if unknown)
    gender: { type: String, enum: ["female", "male", "other", ""] },
    // Prepaid customer credit (paise). Changed only together with an AdvanceTransaction record.
    advanceBalance: { type: Number, default: 0, min: 0 },
    internalNotes: { type: String, maxlength: 2000 },
    marketingConsent: { type: Boolean, default: false },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    firstVisitAt: Date,
    lastVisitAt: Date,
    lastLoginAt: Date,
    // Staff removed by the owner but kept (without email or password) because bills, appointments or
    // payroll records still name them. Hidden from staff lists; can never sign in again.
    deletedAt: Date,
  },
  { timestamps: true },
);

// Registered accounts must have unique emails; guest profiles may repeat.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isGuest: false, email: { $type: "string" } } },
);
userSchema.index({ phone: 1 });
// One guest profile per phone number, so repeat guest bookings share a history.
userSchema.index(
  { phone: 1, isGuest: 1 },
  { unique: true, partialFilterExpression: { isGuest: true, phone: { $type: "string" } } },
);
userSchema.index({ role: 1, active: 1 });
userSchema.index({ name: 1 });

const makeUser = () => model("User", userSchema);
export const User = (models.User as ReturnType<typeof makeUser>) ?? makeUser();
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  ip: String,
  userAgent: { type: String, maxlength: 300 },
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const makeSession = () => model("Session", sessionSchema);
export const Session = (models.Session as ReturnType<typeof makeSession>) ?? makeSession();
