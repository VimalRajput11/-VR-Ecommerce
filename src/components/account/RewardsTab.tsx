"use client";

import { useApi } from "@/lib/api";
import { Card, ErrorState, Spinner } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/time";

interface Data {
  loyalty: null | {
    points: number;
    pointValuePaise: number;
    minRedeemPoints: number;
    pointsPer100: number;
    transactions: { points: number; reason: string; at: string; note?: string }[];
  };
  offers: { id: string; code: string; title: string; description: string; type: string; value: number; endsAt: string; firstVisitOnly: boolean }[];
}

export default function RewardsTab() {
  const { data, error, loading, reload } = useApi<Data>("/api/account/profile");
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Loyalty points">
        {data.loyalty ? (
          <>
            <p className="font-serif text-4xl">{data.loyalty.points}</p>
            <p className="text-sm text-stone">
              points · worth {formatINR(data.loyalty.points * data.loyalty.pointValuePaise)} · earn {data.loyalty.pointsPer100} point(s) per ₹100 paid
            </p>
            <p className="mt-1 text-xs text-stone">Redeem from {data.loyalty.minRedeemPoints} points at the salon counter.</p>
            {data.loyalty.transactions.length > 0 && (
              <ul className="mt-4 divide-y divide-beige text-sm">
                {data.loyalty.transactions.map((t, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span className="capitalize">
                      {t.reason} · {formatDate(t.at)}
                    </span>
                    <span className={t.points > 0 ? "text-success" : "text-stone"}>
                      {t.points > 0 ? "+" : ""}
                      {t.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-stone">Our loyalty programme isn&apos;t running yet. We&apos;ll let you know when it launches.</p>
        )}
      </Card>
      <Card title="Offers for you">
        {data.offers.length ? (
          <ul className="space-y-3">
            {data.offers.map((o) => (
              <li key={o.id} className="rounded-md border border-gold/40 p-4">
                <p className="font-medium">{o.title}</p>
                <p className="text-sm text-stone">
                  {o.type === "percent" ? `${o.value}% off` : `${formatINR(o.value)} off`}
                  {o.firstVisitOnly ? " · first visit" : ""} · until {formatDate(o.endsAt)}
                </p>
                <p className="mt-2 text-xs">
                  Code <span className="rounded bg-cream px-2 py-0.5 font-mono font-semibold">{o.code}</span> — mention it when you pay.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone">No offers right now.</p>
        )}
      </Card>
    </div>
  );
}
