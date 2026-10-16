import type { Metadata } from "next";
import Link from "next/link";
import { IMAGES } from "@/lib/images";
import { PageHero } from "@/components/site/Section";
import Prose from "@/components/site/Prose";
import { getSiteSettings } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How VG Unisex Saloon collects, uses and protects your personal information.",
};

export default async function PrivacyPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero image={IMAGES.salonWhite} eyebrow="Legal" title="Privacy policy" />
      <Prose>
        <p>
          This policy explains how {s.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), {s.address.locality}, {s.address.city}, handles personal information collected through this website and at the salon. It is
          intended to align with India&apos;s Digital Personal Data Protection Act, 2023. The owner should review this policy with a legal adviser before launch.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Contact details you provide: name, mobile number and (optionally) email address.</li>
          <li>Booking details: services, dates, times, preferred stylist and any notes you add.</li>
          <li>Billing records: invoices, payments and refunds. We never store card numbers, CVV, UPI PINs or banking passwords; online payments are processed by our payment provider.</li>
          <li>Account details if you register: a securely hashed password and your notification preferences.</li>
          <li>Service preferences and notes recorded by our team to provide consistent service.</li>
          <li>Job applications sent from our Careers page: your contact details, experience, skills and any link you share. These are used only for hiring and are deleted on request.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To schedule, confirm, remind you about and manage your appointments.</li>
          <li>To issue invoices and receipts and keep accounting records.</li>
          <li>To respond to your messages and requests.</li>
          <li>To send offers only if you have opted in. You can opt out at any time from your account.</li>
        </ul>
        <h2>Sharing</h2>
        <p>We do not sell your data. We share it only with service providers that help us run the salon (for example, hosting, email/SMS delivery and payment processing), and where required by law.</p>
        <h2>Security &amp; retention</h2>
        <p>Access to customer records is restricted by staff role. We keep records only as long as needed for the purposes above and to meet legal and tax obligations.</p>
        <h2>Your choices</h2>
        <p>
          You can view and update your profile and notification preferences in <Link href="/account">your account</Link>. To request access, correction or deletion of your data, please{" "}
          <Link href="/contact">contact us</Link>.
        </p>
        <h2>Cookies</h2>
        <p>We use a single essential cookie to keep you signed in. We do not use advertising cookies.</p>
      </Prose>
    </>
  );
}
