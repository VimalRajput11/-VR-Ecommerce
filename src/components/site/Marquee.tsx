const ITEMS = [
  "Haircuts",
  "Hair Colour",
  "Hair Spa",
  "Smoothening",
  "Beard Styling",
  "Classic Shave",
  "Facials",
  "Threading",
  "Manicure",
  "Pedicure",
  "Party Makeup",
  "Bridal & Groom",
];

/** Decorative scrolling ticker of service names (hidden from screen readers). */
export default function Marquee() {
  const row = (
    <ul className="flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center whitespace-nowrap">
          <span className="px-6 font-serif text-xl italic text-ivory md:text-2xl">{item}</span>
          <span className="text-gold" aria-hidden>
            ✦
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden border-y border-gold/25 bg-charcoal py-5" aria-hidden>
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row}
        {row}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-charcoal to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-charcoal to-transparent" />
    </div>
  );
}
