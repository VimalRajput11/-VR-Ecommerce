"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Scissors, Sparkles, Star } from "lucide-react";
import SafeImage from "./SafeImage";
import { buttonClass } from "@/components/ui/classes";
import { IMAGES } from "@/lib/images";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: EASE },
});

export default function HomeHero({ name, locality, city }: { name: string; locality: string; city: string }) {
  const words = ["Your", "Style,"];
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-charcoal px-4 pb-24 pt-32 md:px-8">
      {/* Slow cinematic zoom on the background photo */}
      <div className="absolute inset-0 -z-20 animate-kenburns">
        <SafeImage src={IMAGES.mensSalon} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal via-charcoal/85 to-charcoal/40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal via-transparent to-charcoal/30" />
      <div className="pointer-events-none absolute -right-40 top-1/4 -z-10 h-[520px] w-[520px] rounded-full bg-gold/15 blur-[120px]" aria-hidden />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <motion.p {...fadeUp(0.1)} className="eyebrow mb-6 flex items-center gap-3 text-gold">
            <span className="h-px w-10 bg-gold" aria-hidden />
            {name} · {locality}, {city}
          </motion.p>

          <h1 className="font-serif text-5xl leading-[1.04] text-ivory sm:text-6xl md:text-7xl xl:text-8xl">
            <span className="block">
              {words.map((w, i) => (
                <motion.span
                  key={w}
                  className="mr-[0.25em] inline-block"
                  initial={{ opacity: 0, y: 40, rotate: 2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 1, delay: 0.25 + i * 0.12, ease: EASE }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
            <motion.span
              className="gold-shimmer block italic"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.55, ease: EASE }}
            >
              Your Confidence.
            </motion.span>
          </h1>

          <motion.p {...fadeUp(0.85)} className="mt-7 max-w-xl text-base leading-relaxed text-ivory/80 md:text-lg">
            A modern unisex salon for haircuts, colour, grooming, skin care, nail care and occasion makeup — thoughtfully done, for everyone.
          </motion.p>

          <motion.div {...fadeUp(1.05)} className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className={buttonClass("gold", "lg", "group")}>
              Book an Appointment
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href="/services" className={buttonClass("light", "lg", "backdrop-blur-sm")}>
              Explore Services
            </Link>
          </motion.div>

          <motion.ul {...fadeUp(1.25)} className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-[0.18em] text-ivory/60">
            {["Hair", "Grooming", "Skin", "Nails", "Makeup"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-gold" aria-hidden /> {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Arched portrait with floating highlight chips (large screens) */}
        <motion.div
          className="relative mx-auto hidden aspect-[3/4] w-full max-w-[420px] lg:block"
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.3, delay: 0.4, ease: EASE }}
        >
          <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-t-full border border-gold/50" aria-hidden />
          <div className="relative h-full overflow-hidden rounded-t-full shadow-2xl">
            <SafeImage src={IMAGES.bridalHair} alt="Stylist finishing a bridal hairstyle" fill sizes="420px" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
          </div>

          <div className="absolute -left-14 top-[18%] animate-float rounded-xl border border-ivory/15 bg-charcoal/70 px-4 py-3 text-ivory shadow-xl backdrop-blur-md">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Scissors size={16} className="text-gold" aria-hidden /> Precision cuts
            </p>
            <p className="text-xs text-mist">for men, women &amp; kids</p>
          </div>
          <div className="absolute -right-10 top-[52%] animate-float-slow rounded-xl border border-ivory/15 bg-charcoal/70 px-4 py-3 text-ivory shadow-xl backdrop-blur-md [animation-delay:1.5s]">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles size={16} className="text-gold" aria-hidden /> Bridal &amp; party
            </p>
            <p className="text-xs text-mist">makeup &amp; styling</p>
          </div>
          <div className="absolute -left-6 bottom-8 animate-float rounded-full bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal shadow-xl [animation-delay:3s]">
            <span className="flex items-center gap-1.5">
              <Star size={13} className="fill-charcoal" aria-hidden /> Book online in a minute
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.a
        href="#featured"
        aria-label="Scroll to services"
        className="absolute bottom-8 left-1/2 hidden h-10 w-6 -translate-x-1/2 justify-center rounded-full border border-ivory/40 pt-2 md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
      >
        <span className="h-2 w-1 animate-scroll-cue rounded-full bg-gold" />
      </motion.a>
    </section>
  );
}
