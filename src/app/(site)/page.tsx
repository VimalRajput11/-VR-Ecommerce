import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock3, Quote, Scissors, ShieldCheck, Sparkles, Users } from "lucide-react";
import SafeImage from "@/components/site/SafeImage";
import ServiceCard from "@/components/site/ServiceCard";
import Stars from "@/components/site/Stars";
import VisitInfo from "@/components/site/VisitInfo";
import HomeHero from "@/components/site/HomeHero";
import Marquee from "@/components/site/Marquee";
import CtaBand from "@/components/site/CtaBand";
import { Section, SectionHeading } from "@/components/site/Section";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getApprovedReviews, getGallery, getPublicCatalog, getPublicOffers } from "@/server/queries/public";
import { getSiteSettings, safeLoad } from "@/server/queries/site";
import { IMAGES } from "@/lib/images";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

const linkArrow = "group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-deep";

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
    // Order matters for the desktop mosaic: tiles 0 and 3 are tall, 6 and 7 are wide.
    { src: IMAGES.bride, alt: "Bride in red with gold jewellery and bridal makeup" },
    { src: IMAGES.beard, alt: "Barber trimming and shaping a client's beard" },
    { src: IMAGES.makeupArtist, alt: "Makeup artist applying bridal eye makeup" },
    { src: IMAGES.bridalHairBack, alt: "Bride's styled hair with floral accessories" },
    { src: IMAGES.mehndi, alt: "Bridal mehndi with gold bangles" },
    { src: IMAGES.henna, alt: "Hands decorated with fresh henna" },
    { src: IMAGES.facialMan, alt: "Man relaxing with a facial mask" },
    { src: IMAGES.manicure, alt: "Pink manicure on mehndi-painted hands" },
  ];
  const galleryItems = (gallery.length ? gallery.map((g) => ({ src: g.url, alt: g.alt })) : inspiration).slice(0, 8);

  return (
    <>
      <HomeHero name={settings.name} locality={settings.address.locality ?? ""} city={settings.address.city ?? ""} />
      <Marquee />

      {/* Featured services */}
      <Section id="featured">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Featured services" title="Look and feel your best">
            From a sharp everyday cut to a full occasion look — choose your service and book a time that suits you.
          </SectionHeading>
          <Reveal className="mb-10">
            <Link href="/services" className={linkArrow}>
              View all services <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </div>
        {featuredList.length ? (
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredList.map((s) => (
              <StaggerItem key={s.id}>
                <ServiceCard service={s} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <p className="text-stone">Our service menu is being updated. Please check back shortly or contact us.</p>
        )}
      </Section>

      {/* Categories & packages */}
      {catalog.categories.length > 0 && (
        <Section tone="cream">
          <SectionHeading eyebrow="Popular treatments & packages" title="Something for every visit" />
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.categories.map((c) => (
              <StaggerItem key={c.id}>
                <Link href={`/services?category=${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-charcoal shadow-sm">
                  <SafeImage
                    src={c.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover opacity-75 transition duration-[1.2s] ease-out group-hover:scale-110 group-hover:opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <span className="mb-3 h-px w-10 bg-gold transition-all duration-500 group-hover:w-20" aria-hidden />
                    <h3 className="font-serif text-2xl text-ivory md:text-3xl">{c.name}</h3>
                    {c.description && <p className="mt-1 text-sm text-ivory/75">{c.description}</p>}
                    <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold opacity-0 transition-all duration-500 group-hover:opacity-100">
                      Explore <ArrowRight size={14} aria-hidden />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          {packages.length > 0 && (
            <>
              <Reveal className="mb-6 mt-16 flex items-end justify-between gap-4">
                <h3 className="font-serif text-2xl md:text-3xl">Value packages</h3>
                <Link href="/offers" className={linkArrow}>
                  All packages <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Reveal>
              <Stagger className="grid gap-6 md:grid-cols-3">
                {packages.map((p) => (
                  <StaggerItem key={p.id}>
                    <ServiceCard service={p} compact />
                  </StaggerItem>
                ))}
              </Stagger>
            </>
          )}
        </Section>
      )}

      {/* Why choose us — split layout with image */}
      <Section tone="dark">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
              <SafeImage src={IMAGES.couple} alt="Bride and groom styled for their wedding" fill sizes="(max-width: 1024px) 90vw, 40vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 to-transparent" />
            </div>
            <div className="absolute -bottom-6 -right-4 hidden w-44 overflow-hidden rounded-xl border-4 border-charcoal shadow-2xl sm:block">
              <div className="relative aspect-square">
                <SafeImage src={IMAGES.kid} alt="Smiling boy with a fresh haircut" fill sizes="176px" className="object-cover" />
              </div>
            </div>
            <div className="absolute -left-4 top-8 animate-float rounded-xl bg-gold px-5 py-4 text-charcoal shadow-xl">
              <p className="font-serif text-2xl leading-none">Unisex</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider">Men · Women · Kids</p>
            </div>
          </Reveal>
          <div>
            <SectionHeading eyebrow="Why choose us" title="A salon made for everyone" dark>
              Led by owner {settings.ownerName}, {settings.name} brings hair, grooming and beauty services together under one roof.
            </SectionHeading>
            <Stagger className="grid gap-5 sm:grid-cols-2">
              {[
                { icon: Users, title: "Truly unisex", text: "Services designed for men, women and kids — from beard styling to bridal looks." },
                { icon: Scissors, title: "Personal consultation", text: "We listen first, then recommend the cut, colour or treatment that suits you." },
                { icon: ShieldCheck, title: "Hygiene first", text: "Clean tools and fresh linens for every client, every time." },
                { icon: Sparkles, title: "Clear pricing", text: "Prices and durations are listed upfront, with no surprises at the counter." },
              ].map(({ icon: Icon, title, text }) => (
                <StaggerItem key={title} className="group rounded-xl border border-ivory/10 bg-ivory/[0.03] p-6 transition-colors duration-500 hover:border-gold/40 hover:bg-ivory/[0.06]">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors duration-500 group-hover:bg-gold group-hover:text-charcoal">
                    <Icon size={22} aria-hidden />
                  </span>
                  <h3 className="font-serif text-xl text-ivory">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{text}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </Section>

      {/* How booking works */}
      <Section>
        <SectionHeading eyebrow="How it works" title="Book in under a minute" align="center" />
        <div className="relative">
        <span className="absolute left-[12%] right-[12%] top-[4.5rem] hidden border-t border-dashed border-gold/50 md:block" aria-hidden />
        <Stagger as="ol" className="relative grid gap-6 md:grid-cols-4">
          {[
            { icon: Scissors, title: "Choose services", text: "Pick one or more services or a package." },
            { icon: Users, title: "Pick a stylist", text: "Choose your stylist or let us assign the first available." },
            { icon: Clock3, title: "Select a time", text: "See live availability and choose a slot that suits you." },
            { icon: CalendarCheck, title: "You're booked", text: "Get a booking reference instantly. Pay at the salon." },
          ].map(({ icon: Icon, title, text }, i) => (
            <StaggerItem as="li" key={title} className="lift relative rounded-xl border border-beige bg-white p-6 text-center">
              <span className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-charcoal text-gold ring-8 ring-ivory">
                <Icon size={28} aria-hidden />
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gold font-serif text-sm text-charcoal">{i + 1}</span>
              </span>
              <h3 className="font-serif text-xl">{title}</h3>
              <p className="mt-2 text-sm text-stone">{text}</p>
            </StaggerItem>
          ))}
        </Stagger>
        </div>
      </Section>

      {/* Offers */}
      {offers.length > 0 && (
        <Section tone="cream">
          <SectionHeading eyebrow="Special offers" title="Current offers" />
          <Stagger className="grid gap-6 md:grid-cols-3">
            {offers.slice(0, 3).map((o) => (
              <StaggerItem key={o.id} className="lift relative overflow-hidden rounded-xl border border-gold/40 bg-white p-7">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/15 blur-2xl" aria-hidden />
                <p className="gold-shimmer font-serif text-4xl">{o.type === "percent" ? `${o.value}% off` : `${formatINR(o.value)} off`}</p>
                <h3 className="mt-3 font-serif text-xl">{o.title}</h3>
                {o.description && <p className="mt-2 text-sm text-stone">{o.description}</p>}
                <p className="mt-5 text-xs text-stone">
                  Code <span className="rounded border border-dashed border-gold px-2 py-1 font-mono font-semibold text-charcoal">{o.code}</span> · until {formatDate(o.endsAt)}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-8">
            <Link href="/offers" className={linkArrow}>
              See all offers &amp; packages <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </Section>
      )}

      {/* Gallery */}
      <Section className={offers.length ? "" : "bg-cream"}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow={gallery.length ? "Gallery" : "Style inspiration"} title={gallery.length ? "Recent work from our salon" : "Looks we love"} />
          <Reveal className="mb-10">
            <Link href="/gallery" className={linkArrow}>
              Visit the gallery <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </div>
        <Stagger className="grid auto-rows-[150px] grid-cols-2 gap-3 md:auto-rows-[200px] md:grid-flow-dense md:grid-cols-4">
          {galleryItems.map((img, i) => (
            <StaggerItem key={i} className={`group relative overflow-hidden rounded-xl bg-cream ${i === 0 || i === 3 ? "md:row-span-2" : ""} ${i >= 6 ? "md:col-span-2" : ""}`}>
              <SafeImage src={img.src} alt={img.alt} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition duration-[1.2s] ease-out group-hover:scale-110" />
              <div className="absolute inset-0 bg-charcoal/0 transition-colors duration-500 group-hover:bg-charcoal/25" />
            </StaggerItem>
          ))}
        </Stagger>
        {!gallery.length && <p className="mt-3 text-xs text-stone">Inspiration imagery. Photos of our own work will appear here soon.</p>}
      </Section>

      {/* Reviews — only genuine, moderated reviews */}
      {reviews.count > 0 && (
        <Section tone="dark">
          <SectionHeading eyebrow="Reviews" title="What our clients say" dark>
            {reviews.average !== null && (
              <span className="inline-flex items-center gap-2">
                <Stars rating={reviews.average} /> {reviews.average} from {reviews.count} verified review{reviews.count === 1 ? "" : "s"}
              </span>
            )}
          </SectionHeading>
          <Stagger className="grid gap-6 md:grid-cols-3">
            {reviews.reviews.slice(0, 3).map((r) => (
              <StaggerItem key={r.id} className="rounded-xl border border-ivory/10 bg-ivory/[0.04] p-7">
                <Quote className="mb-4 text-gold" size={28} aria-hidden />
                <Stars rating={r.rating} />
                {r.comment && <blockquote className="mt-3 leading-relaxed text-ivory/90">&ldquo;{r.comment}&rdquo;</blockquote>}
                <p className="mt-5 text-xs uppercase tracking-wider text-mist">
                  {r.name} · {r.services.join(", ")}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-8">
            <Link href="/reviews" className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold">
              Read all reviews <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Reveal>
        </Section>
      )}

      {/* Visit */}
      <Section tone="cream" id="visit">
        <SectionHeading eyebrow="Visit us" title={`Find ${settings.name}`} />
        <Reveal>
          <VisitInfo settings={settings} />
        </Reveal>
      </Section>

      <CtaBand />
    </>
  );
}
