"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function BrandStory() {
  return (
    <section className="py-32 px-6 md:px-12 bg-brand-black w-full overflow-hidden relative">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24 relative z-10">
        
        {/* Left Side: Images */}
        <div className="w-full lg:w-1/2 relative h-[500px] lg:h-[700px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-0 left-0 w-[80%] h-[80%] z-10"
          >
            <div className="absolute inset-0 border border-brand-white/10 rounded-sm overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400"
                alt="Workshop Imagery"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-brand-black/20" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 right-0 w-[60%] h-[60%] z-20"
          >
            <div className="absolute inset-0 border-4 border-brand-black rounded-sm overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
                alt="Craftsmanship Details"
                fill
                className="object-cover"
              />
            </div>
            {/* Gold accent line */}
            <div className="absolute -left-4 -top-4 w-12 h-12 border-t border-l border-brand-gold z-30" />
            <div className="absolute -right-4 -bottom-4 w-12 h-12 border-b border-r border-brand-gold z-30" />
          </motion.div>
        </div>

        {/* Right Side: Text */}
        <div className="w-full lg:w-1/2">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <h2 className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-6 flex items-center gap-4">
              <span className="w-8 h-[1px] bg-brand-gold"></span>
              Our Heritage
            </h2>
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl text-brand-white mb-8 leading-[1.1]">
              Crafted By Hand. <br />
              <span className="italic gold-gradient-text">Designed With Passion.</span>
            </h3>
            
            <div className="space-y-6 text-brand-white/70 font-light text-base md:text-lg leading-relaxed">
              <p>
                VR Nails is a handmade press-on nail brand focused on elegant, reusable, and premium nail designs. What began as a personal passion for beautiful nails has grown into a dedicated pursuit of quality and craftsmanship.
              </p>
              <p>
                Every single set that leaves our studio is crafted with careful attention to detail. We focus on hand-painting and finishing each nail to ensure a premium look that lasts, using high-quality materials designed for reusability.
              </p>
              <p>
                The result? A flawless, beautiful set of nails that you can wear again and again. Welcome to a better way to experience premium nails from the comfort of your home.
              </p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-12"
            >
              <div className="font-serif text-3xl text-brand-white/40 italic">Varshika Rajput</div>
              <div className="text-xs uppercase tracking-[0.3em] text-brand-gold mt-2">Founder, VR Nails</div>
            </motion.div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
