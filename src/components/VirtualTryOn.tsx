"use client";

import { motion } from "framer-motion";
import { Camera, Upload, Sparkles } from "lucide-react";
import Image from "next/image";

export default function VirtualTryOn() {
  return (
    <section className="py-32 px-6 md:px-12 bg-brand-black w-full relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-brand-gold/5 blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-brand-champagne/5 blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-2 text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-4"
          >
            <Sparkles size={14} /> Virtual Try-On
          </motion.h2>
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-5xl md:text-6xl text-brand-white mb-6"
          >
            See Before <span className="italic gold-gradient-text">You Wear</span>
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-brand-white/70 max-w-2xl mx-auto font-light text-base md:text-lg"
          >
            Get ready to experience our entire collection virtually. Soon, you will be able to upload a photo of your hand and instantly see how our luxury press-on nails look on you.
          </motion.p>
        </div>

        <div className="glass max-w-5xl mx-auto rounded-sm p-1 md:p-2 border border-brand-white/10 shadow-[0_0_50px_rgba(212,175,55,0.05)] relative overflow-hidden">
          {/* Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-white/5 to-transparent pointer-events-none" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 bg-brand-black/80 rounded-sm">
            
            {/* Left Side: Preview Image */}
            <div className="relative h-[400px] md:h-auto overflow-hidden">
              <Image 
                src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
                alt="Luxury hand preview"
                fill
                className="object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-black/90 md:to-brand-black" />
              
              {/* Scanning effect */}
              <motion.div 
                className="absolute inset-x-0 h-1 bg-brand-gold/50 blur-[2px]"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
            </div>

            {/* Right Side: Upload Area */}
            <div className="p-8 md:p-12 flex flex-col justify-center items-center text-center relative z-10">
              <div className="inline-block px-4 py-1 mb-6 border border-brand-gold text-brand-gold text-[10px] uppercase tracking-widest font-bold">
                Coming Soon
              </div>
              
              <h4 className="text-brand-white font-serif text-2xl mb-2">Virtual Try-On Feature</h4>
              <p className="text-brand-white/50 text-sm mb-8 font-light max-w-[250px]">
                We are currently perfecting our virtual fitting room. Check back soon for this exciting new feature.
              </p>
              
              <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-brand-white/10 text-brand-white/40 text-sm font-semibold uppercase tracking-widest cursor-not-allowed">
                <Camera size={18} /> Available Soon
              </button>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
