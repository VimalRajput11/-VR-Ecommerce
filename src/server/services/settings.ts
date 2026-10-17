import { BusinessSettings, type SettingsDoc } from "@/server/models";
import { SALON_EMAIL, SALON_MAP_URL, SALON_PHONE } from "@/server/models/settings";
import { connectDB } from "@/server/db";

export type Settings = SettingsDoc;

export async function getSettings(): Promise<Settings> {
  await connectDB();
  const doc = await BusinessSettings.findOneAndUpdate(
    { _id: "business" },
    { $setOnInsert: { _id: "business" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc as Settings;
}

export function onlinePaymentsConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** The salon's public email: whatever is saved in settings, else the official salon address. */
export function salonEmail(s: Settings) {
  return s.contact?.email || SALON_EMAIL;
}

/** The salon's public phone: whatever is saved in settings, else the official salon number. */
export function salonPhone(s: Settings) {
  return s.contact?.phone || SALON_PHONE;
}

/** The subset of settings that is safe to expose publicly. */
export function publicSettings(s: Settings) {
  return {
    name: s.name,
    ownerName: s.ownerName,
    tagline: s.tagline,
    about: s.about,
    logoUrl: s.logoUrl,
    // Phone, WhatsApp and email are the salon's confirmed details, so they are always shown.
    contact: {
      phone: salonPhone(s),
      whatsapp: s.contact?.whatsapp || SALON_PHONE,
      email: salonEmail(s),
      verified: !!s.contact?.verified,
    },
    address: {
      line1: s.address?.verified ? s.address.line1 : "",
      locality: s.address?.locality,
      city: s.address?.city,
      state: s.address?.state,
      postalCode: s.address?.verified ? s.address.postalCode : "",
      country: s.address?.country,
      // The Maps pin is the salon's confirmed location, so it is used even before the street address is verified.
      mapUrl: s.address?.mapUrl || SALON_MAP_URL,
      verified: !!s.address?.verified,
    },
    socials: s.socials,
    hours: s.hours,
    hoursVerified: s.hoursVerified,
    booking: {
      onlineEnabled: s.booking?.onlineEnabled,
      staffSelectionEnabled: s.booking?.staffSelectionEnabled,
      guestBookingEnabled: s.booking?.guestBookingEnabled,
      requireEmail: s.booking?.requireEmail,
      maxAdvanceDays: s.booking?.maxAdvanceDays,
      minLeadMinutes: s.booking?.minLeadMinutes,
      cancellationCutoffHours: s.booking?.cancellationCutoffHours,
      rescheduleCutoffHours: s.booking?.rescheduleCutoffHours,
    },
    policies: s.policies,
    payments: {
      cash: s.payments?.cash,
      upi: s.payments?.upi,
      card: s.payments?.card,
      online: Boolean(s.payments?.online && onlinePaymentsConfigured()),
    },
    tax: { enabled: s.tax?.enabled, name: s.tax?.name, rateBps: s.tax?.rateBps, inclusive: s.tax?.inclusive },
    features: { reviews: s.features?.reviews, loyalty: s.features?.loyalty },
    homepage: s.homepage,
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;
