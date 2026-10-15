import type { Metadata } from "next";
import ContactForm from "@/components/site/ContactForm";
import VisitInfo from "@/components/site/VisitInfo";
import { PageHero } from "@/components/site/Section";
import { getSiteSettings } from "@/server/queries/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact VG Unisex Saloon in Bade Bazar, Old Rajendra Nagar, Delhi.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Contact" title="We'd love to hear from you">
        Questions about a service, a bridal booking or anything else? Send us a message and we&apos;ll reply as soon as we can.
      </PageHero>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 md:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="mb-6 font-serif text-2xl">Visit or reach us</h2>
          <VisitInfo settings={settings} />
        </div>
        <div className="rounded-lg border border-beige bg-white p-6 md:p-8">
          <h2 className="mb-6 font-serif text-2xl">Send a message</h2>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
