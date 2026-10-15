import type { ReactNode } from "react";
import { cx } from "@/components/ui/classes";

export function Section({ children, className, tone = "light", id }: { children: ReactNode; className?: string; tone?: "light" | "cream" | "dark"; id?: string }) {
  return (
    <section
      id={id}
      className={cx(
        "px-4 py-16 md:px-8 md:py-24",
        tone === "dark" && "bg-charcoal text-ivory",
        tone === "cream" && "bg-cream",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, children, align = "left", dark }: { eyebrow?: string; title: ReactNode; children?: ReactNode; align?: "left" | "center"; dark?: boolean }) {
  return (
    <div className={cx("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className={cx("eyebrow mb-3", dark ? "text-gold" : "text-gold-deep")}>{eyebrow}</p>}
      <h2 className={cx("font-serif text-3xl leading-tight md:text-4xl", dark ? "text-ivory" : "text-charcoal")}>{title}</h2>
      {children && <p className={cx("mt-4 leading-relaxed", dark ? "text-mist" : "text-stone")}>{children}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="bg-charcoal px-4 pb-14 pt-14 text-ivory md:px-8 md:pb-20 md:pt-20">
      <div className="mx-auto max-w-7xl">
        {eyebrow && <p className="eyebrow mb-3 text-gold">{eyebrow}</p>}
        <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl leading-relaxed text-mist">{children}</div>}
      </div>
    </div>
  );
}
