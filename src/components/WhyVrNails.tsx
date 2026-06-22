"use client";

import { motion } from "framer-motion";
import { Sparkles, Recycle, Gem, Fingerprint } from "lucide-react";

const features = [
  {
    icon: <Sparkles size={32} strokeWidth={1} />,
    title: "Handmade Craftsmanship",
    description: "Every set is meticulously hand-painted by master nail artists using premium salon-grade gels."
  },
  {
    icon: <Recycle size={32} strokeWidth={1} />,
    title: "Reusable Designs",
    description: "Crafted for durability. Wear them for weeks or reuse them multiple times for different occasions."
  },
  {
    icon: <Gem size={32} strokeWidth={1} />,
    title: "Premium Finish",
    description: "Finished with top-tier glossy or velvet matte topcoats that never dull, chip, or fade."
  },
  {
    icon: <Fingerprint size={32} strokeWidth={1} />,
    title: "Perfect Fit",
    description: "Available in multiple sizes and shapes to ensure a seamless, natural look tailored to you."
  }
];

export default function WhyVrNails() {
  return (
    <section className="py-32 bg-brand-black w-full overflow-hidden relative border-t border-brand-white/5 border-b">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-brand-gold/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-20">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-4 block"
          >
            The Difference
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl text-brand-white"
          >
            Why <span className="italic gold-gradient-text">VR Nails</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: index * 0.15 }}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-20 h-20 rounded-full border border-brand-white/10 flex items-center justify-center mb-6 text-brand-gold group-hover:border-brand-gold/50 group-hover:bg-brand-gold/5 transition-all duration-500 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="font-serif text-xl text-brand-white mb-3 tracking-wide">{feature.title}</h3>
              <p className="text-brand-white/60 text-sm leading-relaxed font-light max-w-[250px]">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
