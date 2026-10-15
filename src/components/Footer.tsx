import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import type { PublicSettings } from "@/server/services/settings";
import { formatPhone, hoursSummary } from "@/lib/format";

export default function Footer({ settings }: { settings: PublicSettings }) {
  const address = [settings.address.line1, settings.address.locality, settings.address.city, settings.address.postalCode].filter(Boolean).join(", ");
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-charcoal text-ivory/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div>
          <Link href="/" className="mb-4 flex items-center gap-3">
            <Image src="/logo.svg" alt="" width={48} height={48} />
            <span className="font-serif text-lg text-ivory">{settings.name}</span>
          </Link>
          <p className="text-sm leading-relaxed text-mist">
            A unisex salon for hair, grooming, skin, nails and occasion makeup in {settings.address.locality}, {settings.address.city}.
          </p>
        </div>

        <div>
          <h2 className="eyebrow mb-4 text-gold">Explore</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/services" className="hover:text-gold">Services &amp; prices</Link></li>
            <li><Link href="/offers" className="hover:text-gold">Offers &amp; packages</Link></li>
            <li><Link href="/gallery" className="hover:text-gold">Gallery</Link></li>
            <li><Link href="/reviews" className="hover:text-gold">Reviews</Link></li>
            <li><Link href="/about" className="hover:text-gold">About us</Link></li>
            <li><Link href="/careers" className="hover:text-gold">Careers</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow mb-4 text-gold">Help</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/book" className="hover:text-gold">Book an appointment</Link></li>
            <li><Link href="/booking/manage" className="hover:text-gold">Manage a booking</Link></li>
            <li><Link href="/faq" className="hover:text-gold">FAQ</Link></li>
            <li><Link href="/policies" className="hover:text-gold">Booking &amp; cancellation policy</Link></li>
            <li><Link href="/contact" className="hover:text-gold">Contact us</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow mb-4 text-gold">Visit</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
              <span>{address}</span>
            </li>
            {settings.contact.verified && settings.contact.phone && (
              <li className="flex gap-2.5">
                <Phone size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                <a href={`tel:+91${settings.contact.phone}`} className="hover:text-gold">{formatPhone(settings.contact.phone)}</a>
              </li>
            )}
            {settings.contact.verified && settings.contact.email && (
              <li className="flex gap-2.5">
                <Mail size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                <a href={`mailto:${settings.contact.email}`} className="break-all hover:text-gold">{settings.contact.email}</a>
              </li>
            )}
            <li className="flex gap-2.5">
              <Clock size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
              <span>{settings.hoursVerified ? hoursSummary(settings.hours) : "Opening hours will be published soon."}</span>
            </li>
            {!settings.contact.verified && <li className="text-xs text-mist">Phone and email details will be added shortly.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-mist md:flex-row md:px-8">
          <p>&copy; {year} {settings.name}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gold">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gold">Terms &amp; Conditions</Link>
            <Link href="/policies" className="hover:text-gold">Cancellation Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
