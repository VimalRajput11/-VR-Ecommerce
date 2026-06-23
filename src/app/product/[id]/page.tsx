"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, ShoppingBag, ChevronRight, Ruler, Plus, Minus } from "lucide-react";
import { products } from "@/lib/data";
import { useShop } from "@/context/ShopContext";


export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const product = products.find(p => p.id === id);
  
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useShop();
  
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "reviews" | "sizing">("description");

  if (!product) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center text-brand-white">
        Product not found
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);

  return (
    <main className="min-h-screen bg-brand-black w-full flex flex-col">

      <div className="flex-1 pt-32 px-6 md:px-12 max-w-[1600px] mx-auto w-full mb-24">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-brand-white/50 mb-8">
          <button onClick={() => router.push('/shop')} className="hover:text-brand-gold transition-colors">Shop</button>
          <ChevronRight size={12} />
          <button onClick={() => router.push(`/shop?filter=${product.collection}`)} className="hover:text-brand-gold transition-colors">{product.collection}</button>
          <ChevronRight size={12} />
          <span className="text-brand-gold">{product.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 xl:gap-20">
          
          {/* Left: Gallery */}
          <div className="w-full lg:w-3/5 flex flex-col md:flex-row gap-6 h-[50vh] md:h-[700px]">
            {/* Thumbnails */}
            <div className="order-2 md:order-1 flex md:flex-col gap-4 overflow-x-auto md:overflow-y-auto hide-scrollbar">
              {product.images.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`relative w-20 h-24 md:w-24 md:h-32 flex-shrink-0 border transition-colors overflow-hidden rounded-sm ${
                    activeImage === idx ? "border-brand-gold" : "border-transparent opacity-50 hover:opacity-100"
                  }`}
                >
                  <Image src={img} alt={`${product.name} ${idx}`} fill className="object-cover" />
                </button>
              ))}
            </div>
            
            {/* Main Image */}
            <div className="order-1 md:order-2 flex-1 relative bg-brand-dark-gray border border-brand-white/5 rounded-sm overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0"
                >
                  <Image src={product.images[activeImage]} alt={product.name} fill className="object-cover" priority />
                </motion.div>
              </AnimatePresence>
              
              {product.isNewArrival && (
                <span className="absolute top-6 left-6 bg-brand-white text-brand-black text-[10px] uppercase tracking-widest px-3 py-1.5 font-bold z-10">New</span>
              )}
            </div>
          </div>

          {/* Right: Info */}
          <div className="w-full lg:w-2/5 flex flex-col justify-center">
            <h1 className="font-serif text-4xl md:text-5xl text-brand-white mb-2">{product.name}</h1>
            <p className="text-brand-gold text-xs uppercase tracking-[0.3em] font-semibold mb-6">{product.collection} Collection</p>
            
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-brand-white/10">
              <span className="text-2xl text-brand-white/90 font-light">₹{product.price.toFixed(2)}</span>
              <div className="flex items-center gap-2">
                <div className="flex text-brand-gold">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className={i < Math.floor(product.rating) ? "fill-brand-gold" : ""} />
                  ))}
                </div>
                <span className="text-brand-white/50 text-xs tracking-widest">({product.reviewsCount} Reviews)</span>
              </div>
            </div>

            <p className="text-brand-white/70 font-light leading-relaxed mb-8">
              {product.description}
            </p>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-brand-white uppercase tracking-widest text-xs font-semibold">Shape & Length</h4>
                <button className="flex items-center gap-1 text-brand-gold uppercase tracking-widest text-[10px] hover:underline">
                  <Ruler size={12} /> Size Guide
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Short Almond", "Medium Coffin", "Long Stiletto"].map((shape) => (
                  <button key={shape} className="border border-brand-white/20 text-brand-white/70 text-xs py-3 hover:border-brand-gold hover:text-brand-gold transition-colors text-center rounded-sm">
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6 mb-10">
              <div className="flex items-center border border-brand-white/20 rounded-sm">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 text-brand-white/50 hover:text-brand-gold transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-brand-white text-sm">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-3 text-brand-white/50 hover:text-brand-gold transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button 
                onClick={() => inWishlist ? removeFromWishlist(product.id) : addToWishlist(product)}
                className="w-12 h-12 flex items-center justify-center border border-brand-white/20 rounded-sm text-brand-white hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                <Heart size={18} fill={inWishlist ? "#D4AF37" : "transparent"} color={inWishlist ? "#D4AF37" : "currentColor"} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => addToCart(product, quantity)}
                className="w-full py-4 bg-brand-white text-brand-black uppercase tracking-widest text-sm font-bold hover:bg-brand-gold transition-colors flex items-center justify-center gap-2 rounded-sm"
              >
                <ShoppingBag size={16} /> Add To Cart
              </button>
              <button 
                onClick={() => {
                  addToCart(product, quantity);
                  router.push('/checkout');
                }}
                className="w-full py-4 border border-brand-gold/50 text-brand-gold uppercase tracking-widest text-sm font-semibold hover:bg-brand-gold hover:text-brand-black transition-colors flex items-center justify-center rounded-sm"
              >
                Buy It Now
              </button>
            </div>
            
            {/* Tabs */}
            <div className="mt-16 pt-8 border-t border-brand-white/10">
              <div className="flex gap-8 mb-6 border-b border-brand-white/10 pb-4 overflow-x-auto hide-scrollbar">
                {(["description", "sizing", "reviews"] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`uppercase tracking-widest text-xs font-semibold pb-4 relative -mb-4 transition-colors ${
                      activeTab === tab ? "text-brand-gold" : "text-brand-white/50 hover:text-brand-white"
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-[1px] bg-brand-gold" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="min-h-[150px] text-brand-white/70 font-light text-sm leading-relaxed">
                <AnimatePresence mode="wait">
                  {activeTab === "description" && (
                    <motion.div key="desc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <p className="mb-4">Each set includes 24 luxury handmade press-on nails in 12 sizes to ensure a perfect fit for any nail bed. Application kit included.</p>
                      <ul className="list-disc pl-4 space-y-2 text-brand-white/50">
                        <li>Reusable and durable</li>
                        <li>Salon quality materials</li>
                        <li>Includes: Glue, adhesive tabs, file, cuticle stick, prep wipe</li>
                      </ul>
                    </motion.div>
                  )}
                  {activeTab === "sizing" && (
                    <motion.div key="size" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <p className="mb-4">No measuring required! Every set comes with 24 nails in 12 universal sizes (0-11). Simply hold them up to your natural nail to find your perfect match.</p>
                      <p>If you prefer a custom fit, select 'Custom' shape and we will contact you for your exact measurements.</p>
                    </motion.div>
                  )}
                  {activeTab === "reviews" && (
                    <motion.div key="rev" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                      {product.reviews.map(review => (
                        <div key={review.id} className="pb-6 border-b border-brand-white/5 last:border-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-serif text-brand-white">{review.author}</span>
                            <span className="text-[10px] text-brand-white/30 uppercase tracking-widest">{review.date}</span>
                          </div>
                          <div className="flex text-brand-gold mb-3">
                            {[...Array(review.rating)].map((_, i) => <Star key={i} size={10} className="fill-brand-gold" />)}
                          </div>
                          <p className="italic text-brand-white/60">"{review.text}"</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
