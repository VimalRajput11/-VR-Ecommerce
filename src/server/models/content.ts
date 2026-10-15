import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { GALLERY_CATEGORIES } from "@/lib/constants";

const reviewSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    displayName: { type: String, required: true, maxlength: 60 },
    services: [String],
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reply: { type: String, maxlength: 1000 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
  },
  { timestamps: true },
);

const makeReview = () => model("Review", reviewSchema);
export const Review = (models.Review as ReturnType<typeof makeReview>) ?? makeReview();
export type ReviewDoc = InferSchemaType<typeof reviewSchema> & { _id: Types.ObjectId };

const gallerySchema = new Schema(
  {
    url: { type: String, required: true, maxlength: 500 },
    alt: { type: String, required: true, maxlength: 200 },
    caption: { type: String, maxlength: 200 },
    category: { type: String, enum: GALLERY_CATEGORIES, required: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const makeGallery = () => model("GalleryImage", gallerySchema);
export const GalleryImage = (models.GalleryImage as ReturnType<typeof makeGallery>) ?? makeGallery();

const messageSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    phone: { type: String, maxlength: 20 },
    email: { type: String, maxlength: 200 },
    subject: { type: String, maxlength: 60 },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["new", "in_progress", "resolved"], default: "new", index: true },
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

const makeMessage = () => model("ContactMessage", messageSchema);
export const ContactMessage = (models.ContactMessage as ReturnType<typeof makeMessage>) ?? makeMessage();

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    event: { type: String, required: true },
    channel: { type: String, enum: ["inapp", "email", "sms", "whatsapp"], required: true },
    to: String,
    subject: String,
    body: { type: String, maxlength: 4000 },
    status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending" },
    error: String,
    dedupeKey: { type: String, required: true, unique: true },
    readAt: Date,
    link: String,
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, channel: 1, createdAt: -1 });

const makeNotification = () => model("Notification", notificationSchema);
export const Notification = (models.Notification as ReturnType<typeof makeNotification>) ?? makeNotification();

const auditSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User" },
  actorName: String,
  actorRole: String,
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: String,
  summary: { type: String, maxlength: 500 },
  meta: Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now, index: true },
});

const makeAudit = () => model("AuditLog", auditSchema);
export const AuditLog = (models.AuditLog as ReturnType<typeof makeAudit>) ?? makeAudit();
