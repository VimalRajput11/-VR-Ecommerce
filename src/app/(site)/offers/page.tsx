import type { Metadata } from "next";
import Link from "next/link";
import ServiceCard from "@/components/site/ServiceCard";
import { IMAGES } from "@/lib/images";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import { getPublicCatalog, getPublicOffers } from "@/server/queries/public";
import { safeLoad } from "@/server/queries/site";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { buttonClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Offers & Packages",
  description: "Current offers, festival discounts and value packages at VG Unisex Salon.",
};

export default async function OffersPage() {
  const [offers, catalog] = await Promise.all([safeLoad(getPublicOffers, []), safeLoad(getPublicCatalog, { categories: [], services: [] })]);
  const packages = catalog.services.filter((s) => s.kind === "package");
  return (
    <>
      <PageHero image={IMAGES.brideSmile} eyebrow="Offers & packages" title="More value, every visit">
        Seasonal offers and combined packages. Offer codes are applied at billing in the salon.
      </PageHero>
      <Section>
        <SectionHeading eyebrow="Current offers" title="Offers" />
        {offers.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <article key={o.id} className="rounded-lg border border-gold/40 bg-white p-6">
                <p className="font-serif text-3xl text-gold-deep">{o.type === "percent" ? `${o.value}% off` : `${formatINR(o.value)} off`}</p>
                <h2 className="mt-2 font-serif text-xl">{o.title}</h2>
                {o.description && <p className="mt-2 text-sm text-stone">{o.description}</p>}
                <ul className="mt-4 space-y-1 text-xs text-stone">
                  <li>
                    Code: <span className="rounded bg-cream px-2 py-0.5 font-mono font-semibold text-charcoal">{o.code}</span>
                  </li>
                  <li>Valid until {formatDate(o.endsAt)}</li>
                  {o.minSubtotal > 0 && <li>Minimum bill {formatINR(o.minSubtotal)}</li>}
                  {o.type === "percent" && o.maxDiscount > 0 && <li>Maximum discount {formatINR(o.maxDiscount)}</li>}
                  {o.firstVisitOnly && <li>First visit only</li>}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-stone">There are no active offers right now. Follow this page for festival and seasonal offers.</p>
        )}
      </Section>
      <Section tone="cream">
        <SectionHeading eyebrow="Packages" title="Value packages" />
        {packages.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <ServiceCard key={p.id} service={p} />
            ))}
          </div>
        ) : (
          <p className="text-stone">Packages will be listed here soon.</p>
        )}
        <div className="mt-10">
          <Link href="/book" className={buttonClass("primary", "lg")}>
            Book an Appointment
          </Link>
        </div>
      </Section>
    </>
  );
}
