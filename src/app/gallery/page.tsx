import Gallery from "@/components/Gallery";

export default function GalleryPage() {
  return (
    <div className="pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 text-center mb-16">
        <h1 className="font-serif text-4xl md:text-5xl text-brand-white mb-4">
          The <span className="gold-gradient-text italic">Gallery</span>
        </h1>
        <p className="text-brand-white/70 max-w-2xl mx-auto font-light">
          A curated exhibition of our finest handmade press-on nails. Discover the artistry and craftsmanship behind every VR Nails set.
        </p>
      </div>
      <Gallery />
    </div>
  );
}
