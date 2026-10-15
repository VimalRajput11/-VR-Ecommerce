import type { Metadata } from "next";
import ManageBooking from "@/components/booking/ManageBooking";

export const metadata: Metadata = { title: "Manage a booking", robots: { index: false } };

export default function ManageBookingPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-serif text-3xl">Manage a booking</h1>
      <p className="mt-1 mb-8 text-sm text-stone">Enter your booking reference and the mobile number you booked with.</p>
      <ManageBooking />
    </div>
  );
}
