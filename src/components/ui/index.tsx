"use client";

import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, X, AlertCircle, CheckCircle2, Info, Eye, EyeOff } from "lucide-react";
import { STATUS_LABELS, INVOICE_STATUS_LABELS, type AppointmentStatus } from "@/lib/constants";

export { cx, buttonClass } from "./classes";
import { cx, buttonClass, type Variant, type Size } from "./classes";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ---- Form fields ---------------------------------------------------------------------

const inputBase =
  "w-full rounded-md border border-sand bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-stone/60 focus:border-gold-deep focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:bg-cream";

interface FieldWrapProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldWrapProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-stone">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; wrapClassName?: string };

export function Input({ label, hint, error, wrapClassName, className, required, type, ...rest }: InputProps) {
  // Password fields get an eye button that toggles the text between hidden and visible.
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id, describedBy) => {
        const input = (
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={!!error || undefined}
            required={required}
            type={isPassword && showPassword ? "text" : type}
            className={cx(inputBase, isPassword && "pr-11", className)}
            {...rest}
          />
        );
        if (!isPassword) return input;
        return (
          <div className="relative">
            {input}
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone hover:text-charcoal focus-visible:outline-none focus-visible:text-charcoal"
            >
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
        );
      }}
    </Field>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | null; wrapClassName?: string };

export function Textarea({ label, hint, error, wrapClassName, className, required, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id, describedBy) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={!!error || undefined} required={required} className={cx(inputBase, "min-h-[90px]", className)} {...rest} />
      )}
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | null; wrapClassName?: string };

export function Select({ label, hint, error, wrapClassName, className, required, children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapClassName}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={!!error || undefined} required={required} className={cx(inputBase, "pr-8", className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, hint, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className={cx("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-sand accent-[#85652f]" {...rest} />
      <label htmlFor={id} className="text-sm text-charcoal">
        {label}
        {hint && <span className="block text-xs text-stone">{hint}</span>}
      </label>
    </div>
  );
}

// ---- Feedback ------------------------------------------------------------------------

export function Spinner({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-2 py-10 text-sm text-stone", className)} role="status">
      <Loader2 size={18} className="animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: ReactNode; className?: string }) {
  const styles = {
    info: "border-sand bg-cream text-charcoal",
    success: "border-success/30 bg-[#eef5ef] text-success",
    error: "border-danger/30 bg-[#fbefec] text-danger",
    warning: "border-warning/30 bg-[#fbf3e3] text-warning",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" || tone === "warning" ? AlertCircle : Info;
  return (
    <div className={cx("flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm", styles, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-sand bg-white/60 px-6 py-12 text-center">
      <p className="font-serif text-xl text-charcoal">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-stone">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Alert tone="error">
      {error.message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline">
          Try again
        </button>
      )}
    </Alert>
  );
}

// ---- Layout pieces -------------------------------------------------------------------

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-beige bg-white p-5 shadow-[0_1px_2px_rgba(27,26,24,0.04)]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-serif text-lg text-charcoal">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl text-charcoal md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "warning" }) {
  return (
    <div className="rounded-lg border border-beige bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone">{label}</p>
      <p className={cx("mt-1 font-serif text-2xl", tone === "warning" ? "text-warning" : "text-charcoal")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#fbf3e3] text-warning",
  confirmed: "bg-[#eaf1f7] text-[#2b5476]",
  checked_in: "bg-[#efeaf6] text-[#5a3f86]",
  in_progress: "bg-[#f6efe4] text-gold-deep",
  completed: "bg-[#eef5ef] text-success",
  cancelled: "bg-[#f3eeea] text-stone",
  no_show: "bg-[#fbefec] text-danger",
  unpaid: "bg-[#fbefec] text-danger",
  partially_paid: "bg-[#fbf3e3] text-warning",
  paid: "bg-[#eef5ef] text-success",
  partially_refunded: "bg-[#f6efe4] text-gold-deep",
  refunded: "bg-[#f3eeea] text-stone",
  void: "bg-[#f3eeea] text-stone line-through",
};

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", className ?? "bg-cream text-stone")}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as AppointmentStatus] ?? INVOICE_STATUS_LABELS[status] ?? status;
  return <Badge className={STATUS_STYLES[status]}>{label}</Badge>;
}

// ---- Modal ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-charcoal/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx("flex max-h-[92vh] w-full flex-col rounded-t-xl bg-ivory shadow-2xl sm:rounded-xl", width)}>
        <div className="flex items-center justify-between border-b border-beige px-5 py-4">
          <h2 id={titleId} className="font-serif text-xl text-charcoal">
            {title}
          </h2>
          <button type="button" data-close onClick={onClose} className="rounded-md p-1 text-stone hover:bg-charcoal/5 hover:text-charcoal" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-beige px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Tables & pagination -------------------------------------------------------------

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-lg border border-beige bg-white", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={cx("border-b border-beige bg-cream/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone", className)}>
    {children}
  </th>
);

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx("border-b border-beige/70 px-4 py-3 align-top text-charcoal", className)}>{children}</td>
);

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-stone" aria-label="Pagination">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="hide-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-beige">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
            value === t.id ? "border-gold-deep font-medium text-charcoal" : "border-transparent text-stone hover:text-charcoal",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
