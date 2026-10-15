import type { Metadata } from "next";
import Link from "next/link";
import Stars from "@/components/site/Stars";
import { PageHero } from "@/components/site/Section";
import { getApprovedReviews } from "@/server/queries/public";
import { safeLoad } from "@/server/queries/site";
import { formatDate } from "@/lib/time";
import { buttonClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Verified reviews from clients of VG Unisex Saloon.",
};

export default async function ReviewsPage() {
  const data = await safeLoad(() => getApprovedReviews(100), { reviews: [], average: null, count: 0 });
  return (
    <>
      <PageHero eyebrow="Reviews" title="Client reviews">
        Every review here was left by a client after a completed appointment and checked by our team before publishing.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        {data.count > 0 && data.average !== null && (
          <div className="mb-10 flex items-center gap-4 rounded-lg border border-beige bg-white p-6">
            <p className="font-serif text-5xl">{data.average}</p>
            <div>
              <Stars rating={data.average} size={20} />
              <p className="mt-1 text-sm text-stone">
                Based on {data.count} verified review{data.count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        )}
        {data.reviews.length ? (
          <ul className="grid gap-6 md:grid-cols-2">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-beige bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <time className="text-xs text-stone">{formatDate(r.date)}</time>
                </div>
                {r.comment && <p className="mt-3 leading-relaxed">&ldquo;{r.comment}&rdquo;</p>}
                <p className="mt-4 text-sm font-medium">{r.name}</p>
                {r.services.length > 0 && <p className="text-xs text-stone">{r.services.join(", ")}</p>}
                {r.reply && (
                  <div className="mt-4 rounded-md bg-cream p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold-deep">Reply from the salon</p>
                    <p className="mt-1 text-stone">{r.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <p className="font-serif text-2xl">No reviews yet</p>
            <p className="mx-auto mt-2 max-w-md text-stone">
              Reviews appear here once clients share feedback after their appointments. Visited us recently? Sign in to your account to leave a review.
            </p>
            <Link href="/account" className={`${buttonClass("primary")} mt-6`}>
              Go to my account
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
