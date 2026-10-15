import { BusinessSettings, type SettingsDoc } from "@/server/models";
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

/** The subset of settings that is safe to expose publicly. */
export function publicSettings(s: Settings) {
  return {
    name: s.name,
    ownerName: s.ownerName,
    tagline: s.tagline,
    about: s.about,
    logoUrl: s.logoUrl,
    contact: s.contact?.verified
      ? { phone: s.contact.phone, whatsapp: s.contact.whatsapp, email: s.contact.email, verified: true }
      : { phone: "", whatsapp: "", email: "", verified: false },
    address: {
      line1: s.address?.verified ? s.address.line1 : "",
      locality: s.address?.locality,
      city: s.address?.city,
      state: s.address?.state,
      postalCode: s.address?.verified ? s.address.postalCode : "",
      country: s.address?.country,
      mapUrl: s.address?.verified ? s.address.mapUrl : "",
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
