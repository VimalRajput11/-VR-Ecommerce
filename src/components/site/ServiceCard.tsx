import Link from "next/link";
import { Clock } from "lucide-react";
import SafeImage from "./SafeImage";
import type { PublicService } from "@/server/queries/public";
import { formatINR } from "@/lib/money";
import { formatDuration } from "@/lib/format";

export function PriceTag({ price, priceFrom, className }: { price: number | null; priceFrom?: boolean; className?: string }) {
  if (price === null) return <span className={className ?? "text-sm text-stone"}>Price confirmed at salon</span>;
  return (
    <span className={className ?? "font-serif text-lg text-charcoal"}>
      {priceFrom && <span className="mr-1 text-xs font-sans uppercase tracking-wider text-stone">from</span>}
      {formatINR(price)}
    </span>
  );
}

export default function ServiceCard({ service, compact }: { service: PublicService; compact?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-beige bg-white transition-shadow hover:shadow-lg">
      {!compact && (
        <Link href={`/services/${service.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-cream" tabIndex={-1} aria-hidden>
          <SafeImage
            src={service.image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {service.kind === "package" && <span className="absolute left-3 top-3 rounded-full bg-charcoal/85 px-3 py-1 text-[11px] uppercase tracking-wider text-gold">Package</span>}
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow mb-1.5 text-gold-deep">{service.categoryName}</p>
        <h3 className="font-serif text-xl text-charcoal">
          <Link href={`/services/${service.slug}`} className="hover:text-gold-deep">
            {service.name}
          </Link>
        </h3>
        {service.description && <p className="mt-2 line-clamp-2 text-sm text-stone">{service.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <PriceTag price={service.price} priceFrom={service.priceFrom} />
            <p className="mt-0.5 flex items-center gap-1 text-xs text-stone">
              <Clock size={13} aria-hidden /> {formatDuration(service.durationMin)}
            </p>
          </div>
          {service.onlineBooking ? (
            <Link
              href={`/book?service=${service.id}`}
              className="rounded-md bg-charcoal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ivory hover:bg-charcoal-soft"
              aria-label={`Book ${service.name}`}
            >
              Book
            </Link>
          ) : (
            <Link href="/contact" className="text-xs font-semibold uppercase tracking-wider text-gold-deep underline-offset-4 hover:underline">
              Enquire
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
