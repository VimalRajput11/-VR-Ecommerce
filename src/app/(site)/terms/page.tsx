import type { Metadata } from "next";
import Link from "next/link";
import { IMAGES } from "@/lib/images";
import { PageHero } from "@/components/site/Section";
import Prose from "@/components/site/Prose";
import { getSiteSettings } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for using the VG Unisex Saloon website and services.",
};

export default async function TermsPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero image={IMAGES.salonWhite} eyebrow="Legal" title="Terms & conditions" />
      <Prose>
        <p>
          These terms apply to the use of this website and to services provided by {s.name}, {s.address.locality}, {s.address.city}. The owner should review these terms with a legal adviser
          before launch.
        </p>
        <h2>Bookings</h2>
        <ul>
          <li>Bookings are subject to availability and to our <Link href="/policies">booking &amp; cancellation policy</Link>.</li>
          <li>Please provide accurate contact details so we can reach you about your appointment.</li>
          <li>Service durations are estimates; actual time can vary.</li>
        </ul>
        <h2>Prices &amp; payment</h2>
        <ul>
          <li>Prices are in Indian Rupees (₹). Prices marked &ldquo;from&rdquo; or &ldquo;price at salon&rdquo; are confirmed before the service begins.</li>
          <li>{s.tax.enabled ? `Applicable ${s.tax.name} is ${s.tax.inclusive ? "included in" : "added to"} the bill.` : "Applicable taxes, if any, are shown on your invoice."}</li>
          <li>Offers and coupon codes are subject to their stated conditions and cannot be combined unless stated.</li>
        </ul>
        <h2>Health &amp; safety</h2>
        <p>Please tell us about allergies, skin sensitivities or medical conditions before treatments. Patch tests may be recommended for colour and some skin services.</p>
        <h2>Accounts</h2>
        <p>Keep your password confidential. We may suspend accounts that are misused.</p>
        <h2>Reviews</h2>
        <p>Reviews can only be left for completed appointments and are moderated before they are published.</p>
        <h2>Contact</h2>
        <p>
          Questions about these terms? <Link href="/contact">Contact us</Link>.
        </p>
      </Prose>
    </>
  );
}
