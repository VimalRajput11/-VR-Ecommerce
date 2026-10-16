import type { Metadata } from "next";
import Link from "next/link";
import SafeImage from "@/components/site/SafeImage";
import CtaBand from "@/components/site/CtaBand";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import VisitInfo from "@/components/site/VisitInfo";
import { getSiteSettings } from "@/server/queries/site";
import { IMAGES } from "@/lib/images";
import { buttonClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "About Us",
  description: "About VG Unisex Saloon, owned by Varshika Rajput, in Bade Bazar, Old Rajendra Nagar, Delhi.",
};

export default async function AboutPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero image={IMAGES.salonBright} eyebrow="About us" title={`Welcome to ${s.name}`}>
        A unisex salon in {s.address.locality}, {s.address.city}, owned and run by {s.ownerName}.
      </PageHero>
      <Section>
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-cream">
            <SafeImage src={IMAGES.salonBright} alt="Bright, modern salon interior" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <SectionHeading eyebrow="Our story" title="Style and care for everyone" />
            {s.about ? (
              <div className="space-y-4 whitespace-pre-line leading-relaxed text-stone">{s.about}</div>
            ) : (
              <div className="space-y-4 leading-relaxed text-stone">
                <p>
                  {s.name} is a single-location unisex salon offering hair, grooming, skin, nail and makeup services for men, women and children.
                </p>
                <p>
                  Whether you need a quick beard trim, a fresh haircut, a relaxing hair spa or a complete look for a special occasion, our aim is simple: help you leave
                  looking and feeling your best — your style, your confidence.
                </p>
                <p>Every visit starts with a conversation about what you want, so the result suits your look, your routine and your budget.</p>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className={buttonClass("primary", "lg")}>
                Book an Appointment
              </Link>
              <Link href="/services" className={buttonClass("secondary", "lg")}>
                Our services
              </Link>
            </div>
          </div>
        </div>
      </Section>
      <Section tone="dark">
        <SectionHeading eyebrow="Visit" title="Where to find us" dark />
        <VisitInfo settings={s} dark />
      </Section>
      <CtaBand />
    </>
  );
}
