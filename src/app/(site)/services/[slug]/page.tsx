import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ChevronLeft } from "lucide-react";
import SafeImage from "@/components/site/SafeImage";
import ServiceCard, { PriceTag } from "@/components/site/ServiceCard";
import { buttonClass } from "@/components/ui/classes";
import { getPublicCatalog } from "@/server/queries/public";
import { safeLoad } from "@/server/queries/site";
import { formatDuration } from "@/lib/format";

async function load(slug: string) {
  const catalog = await safeLoad(getPublicCatalog, { categories: [], services: [] });
  const service = catalog.services.find((s) => s.slug === slug);
  return { catalog, service };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { service } = await load((await params).slug);
  if (!service) return { title: "Service not found" };
  return { title: service.name, description: service.description || `${service.name} at VG Unisex Salon, Old Rajendra Nagar, Delhi.` };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { catalog, service } = await load((await params).slug);
  if (!service) notFound();
  const related = catalog.services.filter((s) => s.categoryId === service.categoryId && s.id !== service.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
      <Link href={`/services?category=${service.categorySlug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-stone hover:text-charcoal">
        <ChevronLeft size={16} aria-hidden /> {service.categoryName}
      </Link>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cream">
          <SafeImage src={service.image} alt={`${service.name} at VG Unisex Salon`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" priority />
        </div>
        <div>
          <p className="eyebrow text-gold-deep">{service.kind === "package" ? "Package" : service.categoryName}</p>
          <h1 className="mt-2 font-serif text-4xl">{service.name}</h1>
          <div className="mt-4 flex items-center gap-6">
            <PriceTag price={service.price} priceFrom={service.priceFrom} className="font-serif text-2xl" />
            <span className="flex items-center gap-1.5 text-sm text-stone">
              <Clock size={16} aria-hidden /> {formatDuration(service.durationMin)}
            </span>
          </div>
          {service.description && <p className="mt-6 leading-relaxed text-stone">{service.description}</p>}
          {service.includes.length > 0 && (
            <div className="mt-6">
              <p className="font-medium">This package includes</p>
              <ul className="mt-2 list-inside list-disc text-sm text-stone">
                {service.includes.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {service.priceFrom && service.price !== null && <p className="mt-4 text-sm text-stone">Final price depends on hair length, density or the area treated and is confirmed before we begin.</p>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {service.onlineBooking ? (
              <Link href={`/book?service=${service.id}`} className={buttonClass("primary", "lg")}>
                Book this service
              </Link>
            ) : (
              <Link href="/contact" className={buttonClass("primary", "lg")}>
                Enquire / book a consultation
              </Link>
            )}
            <Link href="/services" className={buttonClass("secondary", "lg")}>
              All services
            </Link>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-serif text-2xl">You may also like</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
