import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SafeImage from "./SafeImage";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClass } from "@/components/ui/classes";
import { IMAGES } from "@/lib/images";

export default function CtaBand({
  title = "Ready for a fresh look?",
  text = "Book online in under a minute — choose your service, your stylist and a time that suits you.",
  image = IMAGES.salonDark,
}: {
  title?: string;
  text?: string;
  image?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-charcoal px-4 py-20 md:px-8 md:py-28">
      <SafeImage src={image} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-charcoal via-charcoal/90 to-charcoal/60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 blur-[110px]" aria-hidden />
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="eyebrow mb-4 text-gold">VG Unisex Saloon</p>
        <h2 className="font-serif text-4xl leading-tight text-ivory md:text-6xl">
          {title.split(" ").slice(0, -2).join(" ")} <span className="gold-shimmer italic">{title.split(" ").slice(-2).join(" ")}</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-mist">{text}</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/book" className={buttonClass("gold", "lg", "group")}>
            Book an Appointment
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link href="/services" className={buttonClass("light", "lg")}>
            View Services
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
