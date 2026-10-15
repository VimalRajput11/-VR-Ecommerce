import type { Metadata } from "next";
import ServiceCatalogue from "@/components/site/ServiceCatalogue";
import { PageHero } from "@/components/site/Section";
import { getPublicCatalog } from "@/server/queries/public";
import { safeLoad } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Services & Prices",
  description: "Haircuts, colour, men's grooming, facials, threading, waxing, manicures, pedicures, makeup and packages at VG Unisex Saloon, Old Rajendra Nagar, Delhi.",
};

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const catalog = await safeLoad(getPublicCatalog, { categories: [], services: [] });
  return (
    <>
      <PageHero eyebrow="Services & prices" title="Our service menu">
        Browse every service with its duration and price. Prices marked &ldquo;price at salon&rdquo; are confirmed after a quick consultation.
      </PageHero>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        {catalog.services.length ? (
          <ServiceCatalogue categories={catalog.categories} services={catalog.services} initialCategory={category} />
        ) : (
          <p className="py-16 text-center text-stone">Our service menu is being updated. Please check back shortly or contact the salon.</p>
        )}
      </div>
    </>
  );
}
