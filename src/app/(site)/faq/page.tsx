import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/Section";
import { getSiteSettings } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about booking, payments and visiting VG Unisex Saloon.",
};

export default async function FaqPage() {
  const s = await getSiteSettings();
  const payMethods = [s.payments.cash && "cash", s.payments.upi && "UPI", s.payments.card && "card"].filter(Boolean).join(", ");
  const faqs: { q: string; a: React.ReactNode }[] = [
    { q: "Is VG Unisex Saloon for both men and women?", a: "Yes. We offer hair, grooming, skin, nail and makeup services for men, women and children." },
    {
      q: "How do I book an appointment?",
      a: (
        <>
          Use our <Link href="/book" className="text-gold-deep underline">online booking</Link>: choose your services, pick a stylist (or any available), select a time and confirm. You&apos;ll receive a booking reference straight away.
        </>
      ),
    },
    { q: "Do I need an account to book?", a: s.booking.guestBookingEnabled ? "No. You can book as a guest with your name and mobile number. Creating an account lets you see all your appointments, invoices and offers in one place." : "Yes, please create a free account so we can keep your booking details secure." },
    { q: "Do you accept walk-ins?", a: "Yes, walk-ins are welcome subject to availability. Booking ahead guarantees your preferred time." },
    {
      q: "How can I cancel or reschedule?",
      a: (
        <>
          Sign in to your account, or use <Link href="/booking/manage" className="text-gold-deep underline">Manage a booking</Link> with your booking reference and mobile number. Online changes are possible up to {s.booking.cancellationCutoffHours} hour(s) before your appointment. See our{" "}
          <Link href="/policies" className="text-gold-deep underline">cancellation policy</Link>.
        </>
      ),
    },
    { q: "How do I pay?", a: payMethods ? `You can pay at the salon by ${payMethods}.${s.payments.online ? " Online payment is also available from your account once your invoice is issued." : ""}` : "Payment options are confirmed at the salon." },
    { q: "Why do some services say “price at salon”?", a: "Some prices depend on hair length, density or the area treated. We confirm the price with you before starting." },
    { q: "Do you offer bridal and groom packages?", a: "Yes. Bridal, groom and pre-bridal services are planned with a consultation. Please contact us to discuss dates and requirements." },
  ];
  return (
    <>
      <PageHero eyebrow="Help" title="Frequently asked questions" />
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <div className="divide-y divide-beige rounded-lg border border-beige bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-gold-deep transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-stone">{f.a}</div>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-stone">
          Still have a question? <Link href="/contact" className="text-gold-deep underline">Contact us</Link>.
        </p>
      </div>
    </>
  );
}
