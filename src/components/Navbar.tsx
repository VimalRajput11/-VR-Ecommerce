"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, User, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cx } from "@/components/ui";

const NAV_LINKS = [
  { name: "Services", href: "/services" },
  { name: "Offers", href: "/offers" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export default function Navbar({ businessName, announcement }: { businessName: string; announcement?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const accountHref = user ? (user.role === "customer" ? "/account" : "/dashboard") : "/login";
  const accountLabel = user ? (user.role === "customer" ? "My account" : "Dashboard") : "Sign in";

  return (
    <>
      {announcement && (
        <div className="relative z-50 bg-gold px-4 py-2 text-center text-xs font-medium text-charcoal">{announcement}</div>
      )}
      <header
        className={cx(
          "sticky top-0 z-40 transition-colors duration-300",
          overHero ? "bg-charcoal/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0" : "bg-charcoal/95 shadow-sm backdrop-blur",
          pathname === "/" && "-mb-[76px]",
        )}
      >
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label={`${businessName} home`}>
            <Image src="/logo.svg" alt="" width={44} height={44} priority />
            <span className="hidden font-serif text-lg leading-tight text-ivory sm:block">
              VG <span className="text-gold">Unisex Saloon</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "text-xs uppercase tracking-[0.18em] transition-colors hover:text-gold",
                  pathname.startsWith(l.href) ? "text-gold" : "text-ivory/90",
                )}
              >
                {l.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <Link href={accountHref} className="hidden items-center gap-2 text-xs uppercase tracking-[0.15em] text-ivory/90 hover:text-gold md:flex">
              <User size={18} aria-hidden /> {accountLabel}
            </Link>
            <Link href="/book" className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-charcoal hover:bg-[#d2b47f]">
              <CalendarDays size={16} aria-hidden /> <span className="hidden sm:inline">Book now</span>
              <span className="sm:hidden">Book</span>
            </Link>
            <button
              type="button"
              className="rounded-md p-2 text-ivory hover:bg-ivory/10 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div id="mobile-menu" className="fixed inset-0 z-30 flex flex-col bg-charcoal px-6 pb-10 pt-28 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {[{ name: "Home", href: "/" }, ...NAV_LINKS, { name: "Manage a booking", href: "/booking/manage" }].map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-ivory/10 py-4 font-serif text-2xl text-ivory hover:text-gold">
                {l.name}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <Link href={accountHref} className="rounded-md border border-ivory/30 py-3 text-center text-sm uppercase tracking-widest text-ivory">
              {accountLabel}
            </Link>
            <Link href="/book" className="rounded-md bg-gold py-3 text-center text-sm font-semibold uppercase tracking-widest text-charcoal">
              Book an appointment
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
