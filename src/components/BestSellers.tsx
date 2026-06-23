"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Star, Heart } from "lucide-react";
import React from "react";
import { products, Product } from "@/lib/data";
import { useShop } from "@/context/ShopContext";

function ProductCard({ product }: { product: Product }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useShop();
  const inWishlist = isInWishlist(product.id);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full aspect-[4/5] rounded-sm bg-brand-dark-gray cursor-pointer group"
    >
      <Link href={`/product/${product.id}`} className="absolute inset-0 z-20 pointer-events-auto" />
      
      <div className="absolute inset-0 z-0 overflow-hidden rounded-sm pointer-events-none" style={{ transform: "translateZ(20px)" }}>
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          className="object-cover scale-100 group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
      </div>

      <div className="absolute inset-0 z-10 flex flex-col justify-between p-6 pointer-events-none" style={{ transform: "translateZ(50px)" }}>
        
        {/* Top area */}
        <div className="flex justify-between items-start w-full">
          <div className="glass px-3 py-1 rounded-full flex items-center gap-1 bg-brand-black/50">
            <Star size={12} className="text-brand-gold fill-brand-gold" />
            <span className="text-brand-white text-xs font-semibold">{product.rating}</span>
          </div>
          
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              inWishlist ? removeFromWishlist(product.id) : addToWishlist(product);
            }}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-brand-white hover:text-brand-gold transition-colors pointer-events-auto z-30"
          >
            <Heart size={18} fill={inWishlist ? "#D4AF37" : "transparent"} color={inWishlist ? "#D4AF37" : "currentColor"} />
          </button>
        </div>

        {/* Bottom area */}
        <div className="glass p-5 rounded-sm flex flex-col gap-4 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 border border-brand-white/10 group-hover:border-brand-gold/50 bg-brand-black/40 backdrop-blur-md">
          <div>
            <h4 className="font-serif text-2xl text-brand-white mb-1 group-hover:text-brand-gold transition-colors">{product.name}</h4>
            <p className="text-brand-white/80 text-sm tracking-widest">₹{product.price.toFixed(2)}</p>
          </div>
          
          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart(product);
              }}
              className="flex-1 bg-brand-gold text-brand-black py-3 text-xs uppercase tracking-widest font-bold hover:bg-brand-white transition-colors flex items-center justify-center gap-2 pointer-events-auto z-30"
            >
              <ShoppingBag size={14} /> Add To Cart
            </button>
            <Link 
              href={`/product/${product.id}`}
              className="flex-1 border border-brand-white/30 text-brand-white py-3 text-xs uppercase tracking-widest font-semibold hover:bg-brand-white/10 transition-colors flex items-center justify-center pointer-events-auto z-30"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function BestSellers() {
  const bestSellers = products.filter(p => p.isBestSeller).slice(0, 3); // Take top 3

  return (
    <section className="py-24 px-6 md:px-12 bg-brand-black w-full overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-brand-gold/5 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20 flex flex-col items-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-4 block"
          >
            The Masterpieces
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-6xl text-brand-white"
          >
            Best <span className="italic gold-gradient-text">Sellers</span>
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12" style={{ perspective: "1500px" }}>
          {bestSellers.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-20 text-center"
        >
          <Link href="/shop?filter=best-sellers" className="inline-block px-12 py-5 border border-brand-gold/50 text-brand-gold uppercase tracking-widest text-sm font-semibold hover:bg-brand-gold hover:text-brand-black transition-all duration-500 shadow-[0_0_20px_rgba(212,175,55,0.1)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)]">
            Shop All Best Sellers
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
