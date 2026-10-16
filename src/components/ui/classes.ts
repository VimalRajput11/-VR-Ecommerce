// Pure class-name helpers, safe to use from both server and client components.

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "light";
export type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "shine bg-charcoal text-ivory hover:bg-charcoal-soft",
  gold: "shine bg-gold text-charcoal shadow-[0_10px_30px_-12px_rgba(194,162,107,0.8)] hover:bg-[#d2b47f]",
  secondary: "border border-charcoal/25 text-charcoal hover:border-charcoal hover:bg-charcoal/5",
  light: "border border-ivory/40 text-ivory hover:bg-ivory/10",
  ghost: "text-charcoal hover:bg-charcoal/5",
  danger: "bg-danger text-white hover:bg-[#8a3123]",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-sm tracking-[0.12em] uppercase",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}
