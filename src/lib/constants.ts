// Shared, client-safe enums and labels.

export const ROLES = ["owner", "receptionist", "stylist", "customer"] as const;
export type Role = (typeof ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-Show",
};

/** Statuses that still occupy a stylist's time. */
export const ACTIVE_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "checked_in", "in_progress"];

export const PAYMENT_METHODS = ["cash", "upi", "card", "online"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
// Includes the stored-value methods recorded by the billing screen.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod | "advance" | "giftcard", string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  online: "Online",
  advance: "Advance balance",
  giftcard: "Gift card",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  void: "Void",
};

export const GALLERY_CATEGORIES = [
  "Haircuts & Hairstyles",
  "Hair Colour",
  "Men's Grooming",
  "Skin & Beauty",
  "Makeup & Bridal",
  "Nail Care",
] as const;

export const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  internship: "Internship / Trainee",
  freelance: "Freelance",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  interview: "Interview",
  hired: "Hired",
  rejected: "Not selected",
};

export const SERVICE_AUDIENCES = ["unisex", "men", "women", "kids"] as const;

export const BRAND = {
  name: "VG Unisex Salon",
  short: "VG",
  owner: "Varshika Rajput",
  locality: "Bada Bazar, Old Rajendra Nagar",
  city: "Delhi",
  country: "India",
  tagline: "Your Style, Your Confidence.",
} as const;
