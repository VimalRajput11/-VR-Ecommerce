import { collections } from "@/lib/data";
import Link from "next/link";
import Image from "next/image";

export default function CollectionsPage() {
  return (
    <div className="pt-32 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        <div className="text-center mb-20">
          <h1 className="font-serif text-4xl md:text-5xl text-brand-white mb-4">
            Curated <span className="gold-gradient-text italic">Collections</span>
          </h1>
          <p className="text-brand-white/70 max-w-2xl mx-auto font-light">
            Explore our themed selections. Each collection tells a unique story, designed to complement every mood and occasion in your life.
          </p>
        </div>

        <div className="space-y-32">
          {collections.map((collection, index) => (
            <div key={collection.id} className={`flex flex-col ${index % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center`}>
              
              {/* Image Side */}
              <div className="w-full md:w-1/2 relative h-[500px] group overflow-hidden rounded-sm">
                <Image 
                  src={collection.image} 
                  alt={collection.name}
                  fill
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 border border-brand-white/10 z-10" />
              </div>

              {/* Text Side */}
              <div className="w-full md:w-1/2 flex flex-col items-start px-4 md:px-12">
                <span className="text-brand-gold tracking-[0.3em] text-xs uppercase mb-4">
                  Collection 0{index + 1}
                </span>
                <h2 className="font-serif text-4xl text-brand-white mb-6">
                  {collection.name}
                </h2>
                <p className="text-brand-white/70 font-light leading-relaxed mb-8">
                  {collection.description}
                </p>
                <Link 
                  href="/shop" 
                  className="group flex items-center gap-4 text-brand-white uppercase tracking-widest text-sm hover:text-brand-gold transition-colors"
                >
                  <span className="w-8 h-[1px] bg-brand-white group-hover:bg-brand-gold transition-colors" />
                  Explore Collection
                </Link>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
