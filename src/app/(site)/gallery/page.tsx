import type { Metadata } from "next";
import Link from "next/link";
import GalleryGrid from "@/components/site/GalleryGrid";
import { IMAGES } from "@/lib/images";
import CtaBand from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/Section";
import { getGallery } from "@/server/queries/public";
import { safeLoad } from "@/server/queries/site";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import { buttonClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Haircuts, colour, men's grooming, skin, makeup and nail work from VG Unisex Saloon.",
};

export default async function GalleryPage() {
  const images = await safeLoad(() => getGallery(200), []);
  return (
    <>
      <PageHero image={IMAGES.curls} eyebrow="Gallery" title="Styles from our salon">
        Haircuts and hairstyles, colour, men&apos;s grooming, skin and beauty, makeup and nail care.
      </PageHero>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {images.length ? (
          <GalleryGrid images={images} categories={GALLERY_CATEGORIES} />
        ) : (
          <div className="py-16 text-center">
            <p className="font-serif text-2xl">Our gallery is coming soon</p>
            <p className="mx-auto mt-2 max-w-md text-stone">We&apos;re putting together photos of our work. In the meantime, explore our services or book a visit.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/services" className={buttonClass("secondary")}>
                View services
              </Link>
              <Link href="/book" className={buttonClass("primary")}>
                Book now
              </Link>
            </div>
          </div>
        )}
      </div>
      <CtaBand />
    </>
  );
}
