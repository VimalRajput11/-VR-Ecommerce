"use client";

import { useState } from "react";

// Single-series bar chart (one hue, so no legend; the card title names the series).
// Hover/focus shows a tooltip; a visually-hidden table gives screen readers the data.

interface Datum {
  label: string;
  value: number;
  display: string;
}

export function ColumnChart({ data, title, height = 180 }: { data: Datum[]; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-8 text-center text-sm text-stone">No data for this period.</p>;
  return (
    <figure>
      <div className="relative flex items-end gap-[2px] border-b border-beige" style={{ height }} role="img" aria-label={`${title} chart`}>
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-beige" style={{ bottom: `${f * 100}%` }} aria-hidden />
        ))}
        {data.map((d, i) => (
          <button
            key={d.label + i}
            type="button"
            className="group relative flex h-full flex-1 items-end focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.label}: ${d.display}`}
          >
            <span
              className="w-full rounded-t-[4px] bg-gold-deep transition-opacity group-hover:opacity-80"
              style={{ height: `${d.value > 0 ? Math.max(2, (d.value / max) * 100) : 0}%` }}
            />
            {hover === i && (
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-charcoal px-2 py-1 text-xs text-ivory shadow">
                {d.label}: <strong>{d.display}</strong>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-stone" aria-hidden>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBarList({ data, empty = "No data for this period." }: { data: Datum[]; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-6 text-center text-sm text-stone">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${d.display}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="shrink-0 text-stone">{d.display}</span>
          </div>
          <div className="h-2 rounded-full bg-cream">
            <div className="h-2 rounded-full bg-gold-deep" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
