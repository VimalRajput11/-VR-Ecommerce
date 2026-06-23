"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

const instagramPosts = [
  "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400",
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400",
  "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400",
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400"
];

export default function InstagramShowcase() {
  return (
    <section className="py-24 bg-brand-black w-full overflow-hidden border-t border-brand-white/5">
      <div className="max-w-[2000px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 mb-12 gap-6 text-center md:text-left">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-brand-white mb-2">
              Join The <span className="italic gold-gradient-text">Community</span>
            </h2>
            <p className="text-brand-white/60 font-light text-sm">Tag @vr_nails to be featured</p>
          </div>
          <Link 
            href="https://instagram.com" 
            target="_blank"
            className="flex items-center gap-2 px-6 py-3 border border-brand-white/20 text-brand-white text-xs uppercase tracking-widest hover:border-brand-gold hover:text-brand-gold transition-colors rounded-sm"
          >
            <InstagramIcon size={16} /> Follow Us
          </Link>
        </div>

        <div className="flex w-full overflow-x-auto hide-scrollbar gap-1 md:gap-4 px-1 md:px-4 snap-x">
          {instagramPosts.map((src, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="relative w-[280px] h-[280px] md:w-[350px] md:h-[350px] flex-shrink-0 group overflow-hidden rounded-sm cursor-pointer snap-center"
            >
              <Image 
                src={src}
                alt={`Instagram Post ${idx + 1}`}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/40 transition-colors duration-300 flex items-center justify-center">
                <InstagramIcon size={32} className="text-brand-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
