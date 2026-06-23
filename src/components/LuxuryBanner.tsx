"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function LuxuryBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.1, 1]);

  return (
    <section ref={containerRef} className="relative h-[80vh] w-full overflow-hidden flex items-center justify-center">
      {/* Parallax Background */}
      <motion.div 
        style={{ y, scale }}
        className="absolute inset-0 w-full h-[140%] -top-[20%] z-0"
      >
        <Image
          src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400"
          alt="Luxury At Your Fingertips"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-brand-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-brand-black" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="glass px-8 py-3 rounded-full mb-8 border border-brand-gold/30 backdrop-blur-md"
        >
          <span className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold">
            The Ultimate Accessory
          </span>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl md:text-7xl text-brand-white mb-6 leading-tight"
        >
          Luxury At <span className="italic gold-gradient-text">Your Fingertips</span>.
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-brand-white/80 text-lg md:text-xl font-light mb-10 max-w-2xl mx-auto tracking-wide"
        >
          Every set is designed to make a statement. Experience premium quality styling delivered straight to your door.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <Link 
            href="/shop"
            className="inline-block px-12 py-5 bg-brand-white text-brand-black uppercase tracking-widest text-sm font-semibold hover:bg-brand-gold hover:text-brand-black transition-all duration-500 hover:scale-105"
          >
            Shop The Collection
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
