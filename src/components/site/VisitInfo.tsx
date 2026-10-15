import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";
import type { PublicSettings } from "@/server/services/settings";
import { formatPhone, hoursRange } from "@/lib/format";
import { weekdayName } from "@/lib/time";

export default function VisitInfo({ settings, dark }: { settings: PublicSettings; dark?: boolean }) {
  const muted = dark ? "text-mist" : "text-stone";
  const address = [settings.address.line1, settings.address.locality, settings.address.city, settings.address.state, settings.address.postalCode]
    .filter(Boolean)
    .join(", ");
  const mapsQuery = encodeURIComponent(`${settings.name}, ${address}`);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-5">
        <div className="flex gap-3">
          <MapPin className="mt-1 shrink-0 text-gold" size={20} aria-hidden />
          <div>
            <p className="font-medium">Address</p>
            <p className={muted}>{address}</p>
            <a
              className="mt-1 inline-block text-sm text-gold underline-offset-4 hover:underline"
              href={settings.address.mapUrl || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions
            </a>
            {!settings.address.verified && <p className={`mt-1 text-xs ${muted}`}>Full street address will be added soon.</p>}
          </div>
        </div>
        {settings.contact.verified ? (
          <>
            {settings.contact.phone && (
              <div className="flex gap-3">
                <Phone className="mt-1 shrink-0 text-gold" size={20} aria-hidden />
                <div>
                  <p className="font-medium">Phone</p>
                  <a href={`tel:+91${settings.contact.phone}`} className={`${muted} hover:text-gold`}>{formatPhone(settings.contact.phone)}</a>
                </div>
              </div>
            )}
            {settings.contact.whatsapp && (
              <div className="flex gap-3">
                <MessageCircle className="mt-1 shrink-0 text-gold" size={20} aria-hidden />
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <a href={`https://wa.me/91${settings.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${muted} hover:text-gold`}>
                    {formatPhone(settings.contact.whatsapp)}
                  </a>
                </div>
              </div>
            )}
            {settings.contact.email && (
              <div className="flex gap-3">
                <Mail className="mt-1 shrink-0 text-gold" size={20} aria-hidden />
                <div>
                  <p className="font-medium">Email</p>
                  <a href={`mailto:${settings.contact.email}`} className={`${muted} break-all hover:text-gold`}>{settings.contact.email}</a>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className={`text-sm ${muted}`}>Phone and email details will be published soon. Meanwhile you can book online or send us a message.</p>
        )}
      </div>
      <div>
        <p className="mb-3 font-medium">Opening hours</p>
        {settings.hoursVerified ? (
          <dl className="space-y-1.5 text-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = settings.hours.find((x) => x.day === d);
              return (
                <div key={d} className="flex justify-between gap-4 border-b border-current/10 pb-1.5">
                  <dt>{weekdayName(d)}</dt>
                  <dd className={muted}>{h ? hoursRange(h) : "—"}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className={`text-sm ${muted}`}>Our opening hours will be published soon. Available appointment times are always shown when you book online.</p>
        )}
      </div>
    </div>
  );
}
