"use client";

import { useShop } from "@/context/ShopContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart } = useShop();

  return (
    <main className="min-h-screen bg-brand-black w-full flex flex-col">
      <Navbar />

      <div className="flex-1 pt-32 px-6 md:px-12 max-w-[1200px] mx-auto w-full mb-24">
        <div className="text-center mb-16">
          <h1 className="font-serif text-4xl md:text-6xl text-brand-white mb-4">
            Your <span className="italic gold-gradient-text">Wishlist</span>
          </h1>
          <p className="text-brand-white/60 font-light max-w-2xl mx-auto">
            Curate your personal collection of luxury pieces.
          </p>
        </div>

        {wishlist.length === 0 ? (
          <div className="text-center py-24 glass border border-brand-white/5 rounded-sm">
            <h2 className="font-serif text-2xl text-brand-white mb-4">Your wishlist is empty</h2>
            <p className="text-brand-white/50 mb-8 font-light">Explore our collections to find your perfect match.</p>
            <Link 
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-white text-brand-black uppercase tracking-widest text-sm font-semibold hover:bg-brand-gold transition-colors rounded-sm"
            >
              Discover The Collection <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence>
              {wishlist.map((product) => (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="group"
                >
                  <div className="relative aspect-[3/4] mb-4 bg-brand-dark-gray overflow-hidden rounded-sm">
                    <Link href={`/product/${product.id}`} className="absolute inset-0 z-10" />
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    
                    {/* Action buttons */}
                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                      <button 
                        onClick={() => removeFromWishlist(product.id)}
                        className="w-8 h-8 rounded-full glass border border-brand-white/10 flex items-center justify-center text-brand-white hover:text-red-500 hover:border-red-500 transition-colors bg-brand-black/50"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Move to cart overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          addToCart(product);
                          removeFromWishlist(product.id);
                        }}
                        className="w-full bg-brand-white text-brand-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-brand-gold transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingBag size={14} /> Move To Cart
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-serif text-lg text-brand-white">{product.name}</h3>
                      <span className="text-brand-white/80 font-light text-sm">₹{product.price.toFixed(2)}</span>
                    </div>
                    <span className="text-brand-gold text-xs uppercase tracking-widest">{product.collection}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
