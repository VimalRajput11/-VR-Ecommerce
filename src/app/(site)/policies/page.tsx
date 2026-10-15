import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/Section";
import Prose from "@/components/site/Prose";
import { getSiteSettings } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Booking & Cancellation Policy",
  description: "Booking, cancellation, rescheduling and late-arrival policy for VG Unisex Saloon.",
};

export default async function PoliciesPage() {
  const s = await getSiteSettings();
  const b = s.booking;
  return (
    <>
      <PageHero eyebrow="Policies" title="Booking & cancellation policy" />
      <Prose>
        <h2>Booking</h2>
        {s.policies?.booking ? (
          <p className="whitespace-pre-line">{s.policies.booking}</p>
        ) : (
          <ul>
            <li>Appointments can be booked online up to {b.maxAdvanceDays} days in advance{b.minLeadMinutes ? `, with at least ${b.minLeadMinutes} minutes' notice` : ""}.</li>
            <li>You will receive a booking reference as soon as your request is placed. The salon may confirm your appointment separately.</li>
            <li>Appointment times are shown in Indian Standard Time (IST).</li>
            <li>Prices shown as &ldquo;from&rdquo; or &ldquo;price at salon&rdquo; are confirmed before your service begins.</li>
          </ul>
        )}
        <h2>Cancellations &amp; rescheduling</h2>
        {s.policies?.cancellation ? (
          <p className="whitespace-pre-line">{s.policies.cancellation}</p>
        ) : (
          <ul>
            <li>You can cancel online up to {b.cancellationCutoffHours} hour(s) before your appointment.</li>
            <li>You can reschedule online up to {b.rescheduleCutoffHours} hour(s) before your appointment, subject to availability.</li>
            <li>Within that window, please send a change request from your account or contact the salon and we&apos;ll do our best to help.</li>
            <li>If you are running late, please let us know. We may need to shorten or reschedule the service to avoid delaying other clients.</li>
            <li>Repeated no-shows may mean we ask for confirmation before accepting future bookings.</li>
          </ul>
        )}
        <h2>Manage your booking</h2>
        <p>
          Sign in to <Link href="/account">your account</Link> or use <Link href="/booking/manage">Manage a booking</Link> with your booking reference and mobile number.
        </p>
      </Prose>
    </>
  );
}
