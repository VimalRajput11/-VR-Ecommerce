import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-4 text-center text-ivory">
      <Image src="/logo.svg" alt="VG Unisex Salon" width={72} height={72} />
      <p className="eyebrow mt-8 text-gold">Page not found</p>
      <h1 className="mt-3 font-serif text-4xl">This page has moved or doesn&apos;t exist</h1>
      <p className="mt-3 max-w-md text-mist">Let&apos;s get you back to looking your best.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md border border-ivory/40 px-6 py-3 text-sm uppercase tracking-widest hover:bg-ivory/10">
          Home
        </Link>
        <Link href="/book" className="rounded-md bg-gold px-6 py-3 text-sm font-semibold uppercase tracking-widest text-charcoal">
          Book an appointment
        </Link>
      </div>
    </main>
  );
}
