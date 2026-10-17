"use client";

import { forwardRef, useId, useState } from "react";
import { Search } from "lucide-react";
import { cx } from "@/components/ui/classes";

export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

/**
 * Search box that lists matches underneath as you type. Click a match (or ↑ ↓ then Enter) to pick it.
 */
const SuggestInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    label: string;
    items: Suggestion[];
    onPick: (id: string) => void;
    className?: string;
    /** List suggestions as soon as the box is focused, before anything is typed. */
    showWhenEmpty?: boolean;
    /** Show the label above the box (otherwise it is for screen readers only). */
    visibleLabel?: boolean;
    uppercase?: boolean;
  }
>(function SuggestInput({ value, onChange, placeholder, label, items, onPick, className, showWhenEmpty, visibleLabel, uppercase }, ref) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const showing = open && (showWhenEmpty ? items.length > 0 || value.trim().length > 0 : value.trim().length > 0);
  const pick = (s: Suggestion | undefined) => {
    if (!s || s.disabled) return;
    onPick(s.id);
    setActive(0);
    setOpen(false);
  };

  return (
    <div className={cx("relative", className)}>
      <label className="relative block">
        <span className={visibleLabel ? "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone" : "sr-only"}>{label}</span>
        <Search size={15} className={cx("pointer-events-none absolute left-2.5 text-stone", visibleLabel ? "bottom-3" : "top-1/2 -translate-y-1/2")} aria-hidden />
        <input
          ref={ref}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showing}
          aria-controls={listId}
          aria-autocomplete="list"
          autoCapitalize={uppercase ? "characters" : undefined}
          spellCheck={uppercase ? false : undefined}
          className={cx("w-full rounded-md border border-sand bg-white py-2 pl-8 pr-2 text-sm focus:border-gold focus:outline-none", uppercase && "uppercase")}
        />
      </label>
      {showing && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-[60vh] w-full min-w-72 overflow-y-auto rounded-md border border-beige bg-white shadow-lg">
          {items.length ? (
            items.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === active} aria-disabled={s.disabled}>
                <button
                  type="button"
                  disabled={s.disabled}
                  // Keep focus in the input so the list doesn't close before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={cx("w-full px-3 py-2 text-left text-sm disabled:opacity-50", i === active ? "bg-cream" : "hover:bg-cream/60")}
                >
                  <span className="font-medium">{s.title}</span>
                  {s.subtitle && <span className="block text-xs text-stone">{s.subtitle}</span>}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-stone">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
});

export default SuggestInput;
