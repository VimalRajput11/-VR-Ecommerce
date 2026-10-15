import Link from "next/link";
import { CalendarCheck, Clock3, Scissors, ShieldCheck, Sparkles, Users } from "lucide-react";
import SafeImage from "@/components/site/SafeImage";
import ServiceCard from "@/components/site/ServiceCard";
import Stars from "@/components/site/Stars";
import VisitInfo from "@/components/site/VisitInfo";
import { Section, SectionHeading } from "@/components/site/Section";
import { buttonClass } from "@/components/ui/classes";
import { getApprovedReviews, getGallery, getPublicCatalog, getPublicOffers } from "@/server/queries/public";
import { getSiteSettings, safeLoad } from "@/server/queries/site";
import { IMAGES } from "@/lib/images";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default async function HomePage() {
  const [settings, catalog, offers, reviews, gallery] = await Promise.all([
    getSiteSettings(),
    safeLoad(getPublicCatalog, { categories: [], services: [] }),
    safeLoad(getPublicOffers, []),
    safeLoad(() => getApprovedReviews(6), { reviews: [], average: null, count: 0 }),
    safeLoad(() => getGallery(8), []),
  ]);

  const featured = catalog.services.filter((s) => s.featured && s.kind !== "package").slice(0, 6);
  const featuredList = featured.length ? featured : catalog.services.filter((s) => s.kind !== "package").slice(0, 6);
  const packages = catalog.services.filter((s) => s.kind === "package").slice(0, 3);

  const inspiration = [
    { src: IMAGES.mensCut, alt: "Barber finishing a men's haircut" },
    { src: IMAGES.blowDry, alt: "Stylist blow-drying a client's hair" },
    { src: IMAGES.beard, alt: "Beard grooming with clippers" },
    { src: IMAGES.facial, alt: "Client relaxing during a facial" },
    { src: IMAGES.makeup, alt: "Close-up of occasion eye makeup" },
    { src: IMAGES.manicure, alt: "Manicure in progress" },
    { src: IMAGES.curls, alt: "Natural curls styled and defined" },
    { src: IMAGES.hairWash, alt: "Relaxing hair wash at the basin" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden bg-charcoal px-4 pb-16 pt-32 md:px-8">
        <SafeImage src={IMAGES.heroInterior} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal via-charcoal/80 to-charcoal/30" />
        <div className="mx-auto w-full max-w-7xl">
          <p className="eyebrow mb-5 flex items-center gap-3 text-gold">
            <span className="h-px w-8 bg-gold" aria-hidden /> {settings.name} · {settings.address.locality}, {settings.address.city}
          </p>
          <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] text-ivory md:text-7xl">
            Your Style, <span className="italic text-gold">Your Confidence.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/80 md:text-lg">
            A modern unisex salon for haircuts, colour, grooming, skin care, nail care and occasion makeup — thoughtfully done, for everyone.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className={buttonClass("gold", "lg")}>
              Book an Appointment
            </Link>
            <Link href="/services" className={buttonClass("light", "lg")}>
              Explore Services
            </Link>
          </div>
        </div>
      </section>

      {/* Featured services */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Featured services" title="Look and feel your best">
            From a sharp everyday cut to a full occasion look — choose your service and book a time that suits you.
          </SectionHeading>
          <Link href="/services" className="mb-10 text-sm font-semibold uppercase tracking-wider text-gold-deep underline-offset-4 hover:underline">
            View all services
          </Link>
        </div>
        {featuredList.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredList.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <p className="text-stone">Our service menu is being updated. Please check back shortly or contact us.</p>
        )}
      </Section>

      {/* Categories & packages */}
      {catalog.categories.length > 0 && (
        <Section tone="cream">
          <SectionHeading eyebrow="Popular treatments & packages" title="Something for every visit" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.categories.map((c) => (
              <Link key={c.id} href={`/services?category=${c.slug}`} className="group relative block aspect-[16/10] overflow-hidden rounded-lg bg-charcoal">
                <SafeImage src={c.image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-50" />
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <h3 className="font-serif text-2xl text-ivory">{c.name}</h3>
                  {c.description && <p className="mt-1 text-sm text-ivory/80">{c.description}</p>}
                </div>
              </Link>
            ))}
          </div>
          {packages.length > 0 && (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {packages.map((p) => (
                <ServiceCard key={p.id} service={p} compact />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Why choose us */}
      <Section tone="dark">
        <SectionHeading eyebrow="Why choose us" title="A salon made for everyone" dark>
          Led by owner {settings.ownerName}, {settings.name} brings hair, grooming and beauty services together under one roof.
        </SectionHeading>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, title: "Truly unisex", text: "Services designed for men, women and kids — from beard styling to bridal looks." },
            { icon: Scissors, title: "Personal consultation", text: "We listen first, then recommend the cut, colour or treatment that suits you." },
            { icon: ShieldCheck, title: "Hygiene first", text: "Clean tools and fresh linens for every client, every time." },
            { icon: Sparkles, title: "Clear pricing", text: "Prices and durations are listed upfront, with no surprises at the counter." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon className="mb-4 text-gold" size={28} aria-hidden />
              <h3 className="font-serif text-xl text-ivory">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How booking works */}
      <Section>
        <SectionHeading eyebrow="How it works" title="Book in under a minute" align="center" />
        <ol className="grid gap-6 md:grid-cols-4">
          {[
            { icon: Scissors, title: "Choose services", text: "Pick one or more services or a package." },
            { icon: Users, title: "Pick a stylist", text: "Choose your stylist or let us assign the first available." },
            { icon: Clock3, title: "Select a time", text: "See live availability and choose a slot that suits you." },
            { icon: CalendarCheck, title: "You're booked", text: "Get a booking reference instantly. Pay at the salon." },
          ].map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-lg border border-beige bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal font-serif text-gold">{i + 1}</span>
                <Icon className="text-gold-deep" size={20} aria-hidden />
              </div>
              <h3 className="font-serif text-lg">{title}</h3>
              <p className="mt-1 text-sm text-stone">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/book" className={buttonClass("primary", "lg")}>
            Book an Appointment
          </Link>
        </div>
      </Section>

      {/* Offers */}
      {offers.length > 0 && (
        <Section tone="cream">
          <SectionHeading eyebrow="Special offers" title="Current offers" />
          <div className="grid gap-6 md:grid-cols-3">
            {offers.slice(0, 3).map((o) => (
              <div key={o.id} className="rounded-lg border border-gold/40 bg-white p-6">
                <p className="font-serif text-3xl text-gold-deep">{o.type === "percent" ? `${o.value}% off` : `${formatINR(o.value)} off`}</p>
                <h3 className="mt-2 font-serif text-xl">{o.title}</h3>
                {o.description && <p className="mt-2 text-sm text-stone">{o.description}</p>}
                <p className="mt-4 text-xs text-stone">
                  Use code <span className="rounded bg-cream px-2 py-0.5 font-mono font-semibold text-charcoal">{o.code}</span> at the salon · valid until {formatDate(o.endsAt)}
                </p>
              </div>
            ))}
          </div>
          <Link href="/offers" className="mt-6 inline-block text-sm font-semibold uppercase tracking-wider text-gold-deep underline-offset-4 hover:underline">
            See all offers &amp; packages
          </Link>
        </Section>
      )}

      {/* Gallery */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow={gallery.length ? "Gallery" : "Style inspiration"} title={gallery.length ? "Recent work from our salon" : "Looks we love"} />
          <Link href="/gallery" className="mb-10 text-sm font-semibold uppercase tracking-wider text-gold-deep underline-offset-4 hover:underline">
            Visit the gallery
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(gallery.length ? gallery.map((g) => ({ src: g.url, alt: g.alt })) : inspiration).slice(0, 8).map((img, i) => (
            <div key={i} className={`relative overflow-hidden rounded-lg bg-cream ${i % 5 === 0 ? "aspect-[3/4]" : "aspect-square"}`}>
              <SafeImage src={img.src} alt={img.alt} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
            </div>
          ))}
        </div>
        {!gallery.length && <p className="mt-3 text-xs text-stone">Inspiration imagery. Photos of our own work will appear here soon.</p>}
      </Section>

      {/* Reviews — only genuine, moderated reviews */}
      {reviews.count > 0 && (
        <Section tone="cream">
          <SectionHeading eyebrow="Reviews" title="What our clients say">
            {reviews.average !== null && (
              <span className="inline-flex items-center gap-2">
                <Stars rating={reviews.average} /> {reviews.average} from {reviews.count} verified review{reviews.count === 1 ? "" : "s"}
              </span>
            )}
          </SectionHeading>
          <div className="grid gap-6 md:grid-cols-3">
            {reviews.reviews.slice(0, 3).map((r) => (
              <figure key={r.id} className="rounded-lg border border-beige bg-white p-6">
                <Stars rating={r.rating} />
                {r.comment && <blockquote className="mt-3 text-sm leading-relaxed text-charcoal">&ldquo;{r.comment}&rdquo;</blockquote>}
                <figcaption className="mt-4 text-xs text-stone">
                  {r.name} · {r.services.join(", ")}
                </figcaption>
              </figure>
            ))}
          </div>
          <Link href="/reviews" className="mt-6 inline-block text-sm font-semibold uppercase tracking-wider text-gold-deep underline-offset-4 hover:underline">
            Read all reviews
          </Link>
        </Section>
      )}

      {/* Visit */}
      <Section tone="dark" id="visit">
        <SectionHeading eyebrow="Visit us" title={`Find ${settings.name}`} dark />
        <VisitInfo settings={settings} dark />
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/book" className={buttonClass("gold", "lg")}>
            Book an Appointment
          </Link>
          <Link href="/contact" className={buttonClass("light", "lg")}>
            Send us a message
          </Link>
        </div>
      </Section>
    </>
  );
}
