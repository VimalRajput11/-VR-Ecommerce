import type { Metadata } from "next";
import BookingWizard from "@/components/booking/BookingWizard";
import { getPublicCatalog } from "@/server/queries/public";
import { getSiteSettings, safeLoad } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Book an Appointment",
  description: "Book haircuts, grooming, skin, nail and makeup services online at VG Unisex Salon.",
};

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const [settings, catalog] = await Promise.all([getSiteSettings(), safeLoad(getPublicCatalog, { categories: [], services: [] })]);
  return (
    <div className="bg-cream/60">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <p className="eyebrow text-gold-deep">Online booking</p>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl">Book an appointment</h1>
        {settings.degraded ? (
          <p className="mt-6 rounded-md border border-sand bg-white p-4 text-stone">Online booking is temporarily unavailable. Please try again shortly.</p>
        ) : !settings.booking.onlineEnabled ? (
          <p className="mt-6 rounded-md border border-sand bg-white p-4 text-stone">Online booking is currently paused. Please contact the salon to book.</p>
        ) : (
          <BookingWizard
            categories={catalog.categories}
            services={catalog.services.filter((s) => s.onlineBooking)}
            settings={{
              staffSelectionEnabled: !!settings.booking.staffSelectionEnabled,
              guestBookingEnabled: !!settings.booking.guestBookingEnabled,
              requireEmail: !!settings.booking.requireEmail,
              maxAdvanceDays: settings.booking.maxAdvanceDays ?? 60,
              cancellationCutoffHours: settings.booking.cancellationCutoffHours ?? 0,
              payments: settings.payments,
              name: settings.name,
            }}
            initialServiceId={service}
          />
        )}
      </div>
    </div>
  );
}
