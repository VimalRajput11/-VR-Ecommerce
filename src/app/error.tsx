"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow text-gold-deep">Something went wrong</p>
      <h1 className="mt-3 font-serif text-3xl">We couldn&apos;t load this page</h1>
      <p className="mt-2 max-w-md text-stone">Please try again. If the problem continues, contact the salon.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-charcoal px-5 py-2.5 text-sm text-ivory">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-charcoal/25 px-5 py-2.5 text-sm">
          Home
        </Link>
      </div>
    </main>
  );
}
