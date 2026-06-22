"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

const galleryImages = [
  { id: 1, src: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400", className: "col-span-2 row-span-2", alt: "Nail Close-up" },
  { id: 2, src: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400", className: "col-span-1 row-span-1", alt: "Packaging Detail" },
  { id: 3, src: "https://images.unsplash.com/photo-1595868840228-5e8c13f6406e?auto=format&fit=crop&q=100&w=2400", className: "col-span-1 row-span-1", alt: "Product Shot" },
  { id: 4, src: "/gold_collection.png", className: "col-span-1 row-span-2", alt: "Lifestyle Photography" },
  { id: 5, src: "https://images.unsplash.com/photo-1620002093390-1c3905e0423c?auto=format&fit=crop&q=100&w=2400", className: "col-span-1 row-span-1", alt: "Details" },
  { id: 6, src: "https://images.unsplash.com/photo-1595085340058-2e389df310ab?auto=format&fit=crop&q=100&w=2400", className: "col-span-2 row-span-1", alt: "Editorial" },
];

export default function Gallery() {
  return (
    <section className="py-24 px-6 md:px-12 bg-brand-black w-full overflow-hidden relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-4 block"
            >
              The Gallery
            </motion.span>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-serif text-4xl md:text-5xl text-brand-white"
            >
              Curated <span className="italic gold-gradient-text">Moments</span>
            </motion.h2>
          </div>
          <Link href="https://instagram.com" target="_blank" className="flex items-center gap-2 text-brand-white hover:text-brand-gold transition-colors text-sm uppercase tracking-widest font-semibold pb-1 border-b border-transparent hover:border-brand-gold">
            <InstagramIcon size={16} /> Follow @vr_nails
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[250px] gap-6">
          {galleryImages.map((img, index) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative overflow-hidden group rounded-sm ${img.className} border border-brand-white/5 hover:border-brand-gold/30 transition-colors duration-500 cursor-pointer`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/40 transition-colors duration-500" />
              
              <div className="absolute inset-0 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="text-brand-gold text-xs uppercase tracking-[0.3em] translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{img.alt}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
