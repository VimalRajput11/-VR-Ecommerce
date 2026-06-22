"use client";

import { motion } from "framer-motion";
import { Sparkles, Gift, Clock } from "lucide-react";

export default function VipClub() {
  return (
    <section className="py-32 px-6 md:px-12 bg-brand-rich-black w-full relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-gold/10 rounded-full blur-[150px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-champagne/5 rounded-full blur-[150px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 glass rounded-sm border border-brand-white/10 overflow-hidden shadow-2xl p-1">
        {/* Inner Border */}
        <div className="border border-brand-gold/20 rounded-sm bg-brand-black/60 p-10 md:p-16 lg:p-24 text-center relative overflow-hidden backdrop-blur-xl">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <span className="flex items-center justify-center gap-2 text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-6">
              <Sparkles size={14} /> Exclusive Access
            </span>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-white mb-6">
              Join The <span className="italic gold-gradient-text">VIP Club</span>
            </h2>
            <p className="text-brand-white/70 font-light text-sm md:text-base mb-12">
              Elevate your beauty ritual. Subscribe to receive insider updates, private invitations to new collection drops, and exclusive VIP privileges.
            </p>

            {/* Form */}
            <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto mb-16">
              <input 
                type="email" 
                placeholder="Enter your email address" 
                className="flex-1 bg-transparent border-b border-brand-white/30 px-4 py-3 text-brand-white placeholder:text-brand-white/30 focus:outline-none focus:border-brand-gold transition-colors"
                required
              />
              <button 
                type="submit"
                className="px-8 py-3 bg-brand-gold text-brand-black uppercase tracking-widest text-sm font-bold hover:bg-brand-white transition-colors"
              >
                Subscribe
              </button>
            </form>

            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-brand-white/10 pt-12">
              {[
                { icon: <Clock size={20} />, title: "Early Access", desc: "Shop new drops before the general public." },
                { icon: <Sparkles size={20} />, title: "Exclusive Collections", desc: "Access limited-edition runs and secret items." },
                { icon: <Gift size={20} />, title: "VIP Discounts", desc: "Receive special pricing and anniversary gifts." }
              ].map((benefit, idx) => (
                <div key={idx} className="flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="text-brand-gold mb-3">{benefit.icon}</div>
                  <h4 className="text-brand-white font-medium text-sm mb-1">{benefit.title}</h4>
                  <p className="text-brand-white/50 text-xs font-light">{benefit.desc}</p>
                </div>
              ))}
            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
}
