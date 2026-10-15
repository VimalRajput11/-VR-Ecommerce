import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

export const JOB_TYPES = ["full_time", "part_time", "internship", "freelance"] as const;
export const APPLICATION_STATUSES = ["new", "shortlisted", "interview", "hired", "rejected"] as const;

const jobOpeningSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: JOB_TYPES, default: "full_time" },
    description: { type: String, maxlength: 3000, default: "" },
    requirements: { type: String, maxlength: 3000, default: "" },
    experience: { type: String, maxlength: 120, default: "" }, // e.g. "2+ years"
    salary: { type: String, maxlength: 120, default: "" }, // free text, shown only if filled in
    active: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
jobOpeningSchema.index({ active: 1, archived: 1, order: 1 });

const makeOpening = () => model("JobOpening", jobOpeningSchema);
export const JobOpening = (models.JobOpening as ReturnType<typeof makeOpening>) ?? makeOpening();
export type JobOpeningDoc = InferSchemaType<typeof jobOpeningSchema> & { _id: Types.ObjectId };

const jobApplicationSchema = new Schema(
  {
    openingId: { type: Schema.Types.ObjectId, ref: "JobOpening", default: null }, // null = general application
    position: { type: String, required: true, maxlength: 120 }, // snapshot of the role title
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    email: { type: String, maxlength: 200 },
    city: { type: String, maxlength: 80 },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    skills: { type: String, maxlength: 500 },
    portfolioUrl: { type: String, maxlength: 300 },
    message: { type: String, maxlength: 2000 },
    status: { type: String, enum: APPLICATION_STATUSES, default: "new" },
    notes: { type: String, maxlength: 2000 }, // internal, never shown to the applicant
  },
  { timestamps: true },
);
jobApplicationSchema.index({ status: 1, createdAt: -1 });
jobApplicationSchema.index({ openingId: 1, createdAt: -1 });

const makeApplication = () => model("JobApplication", jobApplicationSchema);
export const JobApplication = (models.JobApplication as ReturnType<typeof makeApplication>) ?? makeApplication();
export type JobApplicationDoc = InferSchemaType<typeof jobApplicationSchema> & { _id: Types.ObjectId };
