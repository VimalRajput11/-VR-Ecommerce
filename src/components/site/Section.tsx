import type { ReactNode } from "react";
import { cx } from "@/components/ui/classes";
import { Reveal } from "@/components/motion/Reveal";
import SafeImage from "./SafeImage";
import { IMAGES } from "@/lib/images";

export function Section({ children, className, tone = "light", id }: { children: ReactNode; className?: string; tone?: "light" | "cream" | "dark"; id?: string }) {
  return (
    <section
      id={id}
      className={cx(
        "relative px-4 py-16 md:px-8 md:py-24",
        tone === "dark" && "overflow-hidden bg-charcoal text-ivory",
        tone === "cream" && "bg-cream",
        className,
      )}
    >
      {tone === "dark" && <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />}
      <div className="relative mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children, align = "left", dark }: { eyebrow?: string; title: ReactNode; children?: ReactNode; align?: "left" | "center"; dark?: boolean }) {
  return (
    <Reveal className={cx("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className={cx("eyebrow mb-4 flex items-center gap-3", align === "center" && "justify-center", dark ? "text-gold" : "text-gold-deep")}>
          <span className="h-px w-8 bg-current opacity-70" aria-hidden />
          {eyebrow}
          {align === "center" && <span className="h-px w-8 bg-current opacity-70" aria-hidden />}
        </p>
      )}
      <h2 className={cx("font-serif text-3xl leading-tight md:text-5xl", dark ? "text-ivory" : "text-charcoal")}>{title}</h2>
      {children && <p className={cx("mt-4 leading-relaxed md:text-lg", dark ? "text-mist" : "text-stone")}>{children}</p>}
    </Reveal>
  );
}

/** Banner at the top of inner pages: photo background, gradient and animated entrance. */
export function PageHero({ eyebrow, title, children, image = IMAGES.salonDark }: { eyebrow?: string; title: ReactNode; children?: ReactNode; image?: string }) {
  return (
    <div className="relative isolate overflow-hidden bg-charcoal px-4 pb-16 pt-16 text-ivory md:px-8 md:pb-24 md:pt-24">
      <div className="absolute inset-0 -z-20 animate-kenburns">
        <SafeImage src={image} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal via-charcoal/85 to-charcoal/50" />
      <div className="pointer-events-none absolute -right-32 -top-24 -z-10 h-[380px] w-[380px] rounded-full bg-gold/15 blur-[100px]" aria-hidden />
      <Reveal className="mx-auto max-w-7xl" y={20}>
        {eyebrow && (
          <p className="eyebrow mb-4 flex items-center gap-3 text-gold">
            <span className="h-px w-10 bg-gold" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl leading-relaxed text-ivory/75 md:text-lg">{children}</div>}
      </Reveal>
    </div>
  );
}
