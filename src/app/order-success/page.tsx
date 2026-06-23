"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Package, Truck, Sparkles } from "lucide-react";


export default function OrderSuccessPage() {
  const orderNumber = `VR-${Math.floor(100000 + Math.random() * 900000)}`;

  return (
    <main className="min-h-screen bg-brand-black w-full flex flex-col">

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-32 mt-16">
        <div className="max-w-2xl w-full text-center relative z-10">
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-8 relative"
          >
            <motion.div 
              className="absolute inset-0 border border-brand-gold rounded-full"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <CheckCircle2 size={48} className="text-brand-gold" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-white mb-6">
              Thank You <br />
              <span className="italic gold-gradient-text text-3xl md:text-4xl">For Your Order</span>
            </h1>
            <p className="text-brand-white/70 font-light text-lg mb-2">
              Your luxury experience is being prepared.
            </p>
            <p className="text-brand-gold font-medium mb-12">
              Order #{orderNumber}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass border border-brand-white/10 rounded-sm p-8 mb-12 flex flex-col sm:flex-row justify-around gap-8 text-left bg-brand-black/40"
          >
            <div className="flex gap-4">
              <div className="text-brand-gold pt-1"><Package size={24} strokeWidth={1.5} /></div>
              <div>
                <h4 className="text-brand-white font-medium mb-1">Processing</h4>
                <p className="text-brand-white/50 text-xs font-light">Your order is being carefully handcrafted and prepared. (2-3 business days)</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-brand-gold pt-1"><Truck size={24} strokeWidth={1.5} /></div>
              <div>
                <h4 className="text-brand-white font-medium mb-1">Estimated Delivery</h4>
                <p className="text-brand-white/50 text-xs font-light">You will receive a tracking link once your order ships.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link 
              href="/shop"
              className="px-8 py-4 bg-brand-white text-brand-black uppercase tracking-widest text-sm font-bold hover:bg-brand-gold transition-colors flex items-center justify-center gap-2 rounded-sm"
            >
              <Sparkles size={16} /> Explore More
            </Link>
            <Link 
              href="/"
              className="px-8 py-4 border border-brand-white/20 text-brand-white uppercase tracking-widest text-sm font-semibold hover:border-brand-gold hover:text-brand-gold transition-colors flex items-center justify-center gap-2 rounded-sm"
            >
              Return Home <ArrowRight size={16} />
            </Link>
          </motion.div>

        </div>
        
        {/* Abstract Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-gold/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-champagne/5 rounded-full blur-[120px]" />
        </div>
      </div>
    </main>
  );
}
