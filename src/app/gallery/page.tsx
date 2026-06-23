import Image from "next/image";

const sections = [
  {
    title: "Product Closeups",
    images: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400",
      "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
    ]
  },
  {
    title: "Nail Styling",
    images: [
      "https://images.unsplash.com/photo-1516975080661-46b0d91244e8?auto=format&fit=crop&q=100&w=2400",
      "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
    ]
  },
  {
    title: "Packaging",
    images: [
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400"
    ]
  },
  {
    title: "Behind The Scenes",
    images: [
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400"
    ]
  },
  {
    title: "Customer Inspiration",
    images: [
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400"
    ]
  }
];

export default function GalleryPage() {
  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-black">
      <div className="max-w-7xl mx-auto px-6 md:px-12 text-center mb-24">
        <h1 className="font-serif text-4xl md:text-6xl text-brand-white mb-6">
          The <span className="gold-gradient-text italic">Gallery</span>
        </h1>
        <p className="text-brand-white/70 max-w-2xl mx-auto font-light text-lg">
          A curated exhibition of our handmade press-on nails. Discover the details and inspiration behind VR Nails.
        </p>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-12 space-y-32">
        {sections.map((section, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-6 mb-12">
              <h2 className="font-serif text-3xl md:text-4xl text-brand-white">{section.title}</h2>
              <div className="h-[1px] flex-1 bg-brand-white/10"></div>
            </div>
            
            <div className={`grid grid-cols-1 ${section.images.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-4xl mx-auto'} gap-8`}>
              {section.images.map((src, i) => (
                <div key={i} className="relative aspect-[4/5] md:aspect-[16/10] overflow-hidden group cursor-pointer border border-brand-white/5 rounded-sm">
                  <Image 
                    src={src}
                    alt={`${section.title} Image ${i + 1}`}
                    fill
                    className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/20 transition-colors duration-500" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
