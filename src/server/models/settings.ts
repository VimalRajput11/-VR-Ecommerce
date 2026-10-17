import { Schema, model, models, type InferSchemaType } from "mongoose";

// Single document (_id "business") holding all configuration for the one salon location.

const breakSchema = new Schema({ start: String, end: String }, { _id: false });
const hoursSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    closed: { type: Boolean, default: false },
    open: { type: String, default: "10:00" },
    close: { type: String, default: "20:00" },
    breaks: { type: [breakSchema], default: [] },
  },
  { _id: false },
);

export const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  closed: false,
  open: "10:00",
  close: "20:00",
  breaks: [],
}));

export const SALON_EMAIL = "vgunisexsalon@gmail.com";
export const SALON_PHONE = "8800401064";
export const SALON_MAP_URL = "https://maps.app.goo.gl/pcxn31d9EGdMWAgw6";

const settingsSchema = new Schema(
  {
    _id: { type: String, default: "business" },
    name: { type: String, default: "VG Unisex Salon", maxlength: 100 },
    ownerName: { type: String, default: "Varshika Rajput", maxlength: 100 },
    tagline: { type: String, default: "Your Style, Your Confidence.", maxlength: 160 },
    about: { type: String, maxlength: 3000, default: "" },
    logoUrl: { type: String, default: "/logo.png", maxlength: 500 },
    contact: {
      phone: { type: String, default: SALON_PHONE, maxlength: 20 },
      whatsapp: { type: String, default: SALON_PHONE, maxlength: 20 },
      email: { type: String, default: SALON_EMAIL, maxlength: 200 },
      verified: { type: Boolean, default: false },
    },
    address: {
      line1: { type: String, default: "", maxlength: 200 },
      locality: { type: String, default: "Bada Bazar, Old Rajendra Nagar", maxlength: 200 },
      city: { type: String, default: "Delhi", maxlength: 80 },
      state: { type: String, default: "Delhi", maxlength: 80 },
      postalCode: { type: String, default: "", maxlength: 10 },
      country: { type: String, default: "India", maxlength: 60 },
      mapUrl: { type: String, default: SALON_MAP_URL, maxlength: 500 },
      verified: { type: Boolean, default: false },
    },
    socials: {
      instagram: { type: String, default: "", maxlength: 200 },
      facebook: { type: String, default: "", maxlength: 200 },
    },
    hours: { type: [hoursSchema], default: DEFAULT_HOURS },
    hoursVerified: { type: Boolean, default: false },
    booking: {
      onlineEnabled: { type: Boolean, default: true },
      slotIntervalMin: { type: Number, default: 15, min: 5, max: 60 },
      minLeadMinutes: { type: Number, default: 60, min: 0, max: 10080 },
      maxAdvanceDays: { type: Number, default: 60, min: 1, max: 365 },
      staffSelectionEnabled: { type: Boolean, default: true },
      guestBookingEnabled: { type: Boolean, default: true },
      autoConfirm: { type: Boolean, default: false },
      requireEmail: { type: Boolean, default: false },
      cancellationCutoffHours: { type: Number, default: 4, min: 0, max: 168 },
      rescheduleCutoffHours: { type: Number, default: 4, min: 0, max: 168 },
    },
    policies: {
      booking: { type: String, maxlength: 4000, default: "" },
      cancellation: { type: String, maxlength: 4000, default: "" },
    },
    tax: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: "GST", maxlength: 20 },
      rateBps: { type: Number, default: 1800, min: 0, max: 5000 }, // basis points: 1800 = 18%
      inclusive: { type: Boolean, default: false },
      gstin: { type: String, default: "", maxlength: 20 },
    },
    payments: {
      cash: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
      card: { type: Boolean, default: false },
      online: { type: Boolean, default: false }, // needs Razorpay credentials too
      upiId: { type: String, default: "", maxlength: 100 },
    },
    invoice: {
      prefix: { type: String, default: "VG", maxlength: 10 },
      footerNote: { type: String, default: "Thank you for visiting VG Unisex Salon.", maxlength: 300 },
    },
    features: {
      inventory: { type: Boolean, default: false },
      retail: { type: Boolean, default: false },
      loyalty: { type: Boolean, default: false },
      reviews: { type: Boolean, default: true },
      staffAccounts: { type: Boolean, default: true },
    },
    loyalty: {
      pointsPer100: { type: Number, default: 1, min: 0, max: 100 }, // points earned per ₹100 paid
      pointValuePaise: { type: Number, default: 100, min: 0 }, // value of 1 point when redeemed
      minRedeemPoints: { type: Number, default: 50, min: 0 },
    },
    discounts: {
      receptionistMaxPercent: { type: Number, default: 10, min: 0, max: 100 },
    },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      reminderHoursBefore: { type: Number, default: 24, min: 1, max: 72 },
    },
    homepage: {
      announcement: { type: String, default: "", maxlength: 200 },
    },
  },
  { timestamps: true },
);

const makeSettings = () => model("BusinessSettings", settingsSchema);
export const BusinessSettings = (models.BusinessSettings as ReturnType<typeof makeSettings>) ?? makeSettings();
export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
