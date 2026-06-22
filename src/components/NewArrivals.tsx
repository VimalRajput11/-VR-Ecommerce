"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { products } from "@/lib/data";
import { useShop } from "@/context/ShopContext";

export default function NewArrivals() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const newArrivals = products.filter(p => p.isNewArrival);
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useShop();

  return (
    <section ref={containerRef} className="py-24 bg-brand-rich-black w-full overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 md:px-12 mb-12 flex justify-between items-end">
        <div>
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-gold text-xs tracking-[0.3em] uppercase mb-4 block"
          >
            Just Dropped
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-serif text-brand-white"
          >
            New <span className="italic gold-gradient-text">Arrivals</span>
          </motion.h2>
        </div>
        <Link href="/shop?filter=new" className="hidden md:flex items-center gap-2 text-xs text-brand-white uppercase tracking-[0.2em] hover:text-brand-gold transition-colors group">
          View All
          <motion.span className="group-hover:translate-x-1 transition-transform">→</motion.span>
        </Link>
      </div>

      <motion.div 
        style={{ x }}
        className="flex gap-8 px-6 md:px-12 w-max"
      >
        {newArrivals.map((product, index) => {
          const inWishlist = isInWishlist(product.id);
          
          return (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="w-[280px] md:w-[320px] group"
            >
              <div className="relative aspect-[3/4] mb-6 overflow-hidden bg-brand-black border border-brand-white/5 group-hover:border-brand-gold/30 transition-colors duration-500">
                <Link href={`/product/${product.id}`} className="absolute inset-0 z-10" />
                
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Secondary Image on Hover if exists */}
                {product.images[1] && (
                  <Image
                    src={product.images[1]}
                    alt={`${product.name} alternate view`}
                    fill
                    className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  />
                )}

                {/* Actions overlay */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      addToCart(product);
                    }}
                    className="flex-1 bg-brand-white text-brand-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-brand-gold transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={14} /> Add
                  </button>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      if (inWishlist) {
                        removeFromWishlist(product.id);
                      } else {
                        addToWishlist(product);
                      }
                    }}
                    className="w-12 glass flex items-center justify-center text-brand-white hover:text-brand-gold transition-colors"
                  >
                    <Heart size={16} fill={inWishlist ? "#D4AF37" : "transparent"} color={inWishlist ? "#D4AF37" : "currentColor"} />
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="font-serif text-lg text-brand-white mb-1 group-hover:text-brand-gold transition-colors">{product.name}</h3>
                <p className="text-brand-white/70 text-sm">₹{product.price.toFixed(2)}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
