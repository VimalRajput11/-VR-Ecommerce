"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { featuredCollections } from "@/lib/data";

export default function FeaturedCollections() {
  return (
    <section className="py-24 bg-brand-black w-full relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col items-center mb-16 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4"
          >
            Discover
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-serif text-brand-white"
          >
            Signature <span className="italic gold-gradient-text">Collections</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredCollections.map((collection, index) => (
            <motion.div
              key={collection.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`group relative overflow-hidden rounded-sm cursor-pointer block ${
                index === 3 ? "lg:col-span-2 lg:aspect-[2/1]" : "aspect-[4/5]"
              } ${index === 4 ? "lg:aspect-[4/5]" : ""}`}
            >
              <Link href={`/shop?collection=${encodeURIComponent(collection.name)}`} className="absolute inset-0 z-20" />
              
              <div className="absolute inset-0 bg-brand-black transition-transform duration-700 group-hover:scale-105">
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  className="object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-700"
                />
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/20 to-transparent z-10" />

              {/* Gold border glow on hover */}
              <div className="absolute inset-0 border border-brand-white/10 group-hover:border-brand-gold/50 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all duration-500 z-10" />

              <div className="absolute bottom-0 left-0 p-8 z-10 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="text-2xl font-serif text-brand-white mb-2">{collection.name}</h3>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                  <span className="text-xs text-brand-gold uppercase tracking-[0.2em]">Explore</span>
                  <motion.span 
                    className="text-brand-gold"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    →
                  </motion.span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
