"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Clock } from "lucide-react";
import type { PublicCategory, PublicService } from "@/server/queries/public";
import { formatDuration } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { cx } from "@/components/ui";

const AUDIENCES = [
  { id: "all", label: "Everyone" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "kids", label: "Kids" },
];

export default function ServiceCatalogue({ categories, services, initialCategory }: { categories: PublicCategory[]; services: PublicService[]; initialCategory?: string }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(initialCategory && categories.some((c) => c.slug === initialCategory) ? initialCategory : "all");
  const [audience, setAudience] = useState("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return services.filter(
      (s) =>
        (category === "all" || s.categorySlug === category) &&
        (audience === "all" || s.audience === audience || s.audience === "unisex") &&
        (!term || s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term) || s.categoryName.toLowerCase().includes(term)),
    );
  }, [services, q, category, audience]);

  const grouped = categories
    .map((c) => ({ category: c, items: filtered.filter((s) => s.categoryId === c.id) }))
    .filter((g) => g.items.length);

  return (
    <div>
      <div className="sticky top-[76px] z-20 -mx-4 mb-8 border-b border-beige bg-ivory/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        {/* Row 1: search + audience */}
        <div className="flex items-center gap-3">
          <label className="relative block min-w-0 flex-1 md:max-w-md">
            <span className="sr-only">Search services</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search services…"
              className="w-full rounded-full border border-sand bg-white py-2.5 pl-9 pr-4 text-sm focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </label>
          <label className="ml-auto shrink-0">
            <span className="sr-only">Who is it for</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-full border border-sand bg-white py-2.5 pl-4 pr-8 text-sm focus:border-gold-deep focus:outline-none">
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Row 2: categories — wrap on tablet/desktop, swipe on phones with an edge fade */}
        <div className="relative mt-3">
          <div
            className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            role="group"
            aria-label="Filter by category"
          >
            {[{ slug: "all", name: "All services" }, ...categories].map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={category === c.slug}
                onClick={() => setCategory(c.slug)}
                className={cx(
                  "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-300",
                  category === c.slug ? "border-charcoal bg-charcoal text-ivory shadow-sm" : "border-sand bg-white text-charcoal hover:-translate-y-0.5 hover:border-gold-deep",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-l from-ivory to-transparent sm:hidden" aria-hidden />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length} services shown
      </p>

      {grouped.length === 0 ? (
        <p className="py-16 text-center text-stone">No services match your search. Try a different term or category.</p>
      ) : (
        <div className="space-y-14">
          {grouped.map(({ category: c, items }) => (
            <section key={c.id} aria-labelledby={`cat-${c.slug}`}>
              <h2 id={`cat-${c.slug}`} className="font-serif text-2xl text-charcoal md:text-3xl">
                {c.name}
              </h2>
              {c.description && <p className="mt-1 text-sm text-stone">{c.description}</p>}
              <ul className="mt-6 divide-y divide-beige rounded-lg border border-beige bg-white">
                {items.map((s) => (
                  <li key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-serif text-lg">
                        <Link href={`/services/${s.slug}`} className="hover:text-gold-deep">
                          {s.name}
                        </Link>
                        {s.kind === "package" && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 align-middle text-[11px] uppercase tracking-wider text-gold-deep">Package</span>}
                      </h3>
                      {s.description && <p className="mt-1 text-sm text-stone">{s.description}</p>}
                      {s.includes.length > 0 && <p className="mt-1 text-xs text-stone">Includes: {s.includes.join(", ")}</p>}
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-6 sm:justify-end">
                      <div className="text-right">
                        <p className="font-serif text-lg">
                          {s.price === null ? (
                            <span className="font-sans text-sm text-stone">Price at salon</span>
                          ) : (
                            <>
                              {s.priceFrom && <span className="mr-1 font-sans text-xs uppercase text-stone">from</span>}
                              {formatINR(s.price)}
                            </>
                          )}
                        </p>
                        <p className="flex items-center justify-end gap-1 text-xs text-stone">
                          <Clock size={12} aria-hidden /> {formatDuration(s.durationMin)}
                        </p>
                      </div>
                      {s.onlineBooking ? (
                        <Link href={`/book?service=${s.id}`} className="rounded-md bg-charcoal px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ivory hover:bg-charcoal-soft" aria-label={`Book ${s.name}`}>
                          Book
                        </Link>
                      ) : (
                        <Link href="/contact" className="rounded-md border border-charcoal/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:border-charcoal" aria-label={`Enquire about ${s.name}`}>
                          Enquire
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
