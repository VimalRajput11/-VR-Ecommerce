"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, Heart, ShoppingBag, Star } from "lucide-react";
import { products, Product } from "@/lib/data";
import { useShop } from "@/context/ShopContext";


const categories = ["All", "Bridal", "Butterfly", "Chrome", "Nude", "Gold Luxury"];
const sortOptions = ["Featured", "Price: Low to High", "Price: High to Low", "Highest Rated"];
const shapeOptions = ["All", "Stiletto", "Almond", "Coffin", "Square", "Oval"];
const lengthOptions = ["All", "Short", "Medium", "Long", "Extra Long"];
const occasionOptions = ["All", "Everyday", "Wedding", "Party", "Vacation"];

export default function ShopPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Featured");
  const [activeShape, setActiveShape] = useState("All");
  const [activeLength, setActiveLength] = useState("All");
  const [activeOccasion, setActiveOccasion] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useShop();

  // Filter and Sort Logic
  let filteredProducts = products;
  
  if (activeCategory !== "All") {
    filteredProducts = filteredProducts.filter(p => p.collection === activeCategory);
  }
  
  if (activeShape !== "All") {
    filteredProducts = filteredProducts.filter(p => p.shape === activeShape);
  }
  
  if (activeLength !== "All") {
    filteredProducts = filteredProducts.filter(p => p.length === activeLength);
  }
  
  if (activeOccasion !== "All") {
    filteredProducts = filteredProducts.filter(p => p.occasion === activeOccasion);
  }
  
  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (sortBy === "Price: Low to High") {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (sortBy === "Price: High to Low") {
    filteredProducts.sort((a, b) => b.price - a.price);
  } else if (sortBy === "Highest Rated") {
    filteredProducts.sort((a, b) => b.rating - a.rating);
  }

  return (
    <main className="min-h-screen bg-brand-black w-full flex flex-col">

      <div className="flex-1 pt-32 px-6 md:px-12 max-w-[1600px] mx-auto w-full mb-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-serif text-4xl md:text-6xl text-brand-white mb-4">
            The <span className="italic gold-gradient-text">Collection</span>
          </h1>
          <p className="text-brand-white/60 font-light max-w-2xl mx-auto">
            Discover our complete range of luxury handmade press-on nails.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-brand-white/10 pb-6">
          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto hide-scrollbar pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                  activeCategory === cat 
                    ? "bg-brand-gold text-brand-black font-semibold" 
                    : "text-brand-white/70 hover:text-brand-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="relative group w-full md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-white/50 group-focus-within:text-brand-gold transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-brand-white/5 border border-brand-white/10 pl-10 pr-4 py-2 text-sm text-brand-white focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
            
            <div className="flex gap-2 relative z-20">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 border border-brand-white/10 px-4 py-2 text-sm text-brand-white hover:border-brand-gold transition-colors whitespace-nowrap ${isFilterOpen ? 'bg-brand-gold text-brand-black hover:text-brand-black' : 'bg-brand-white/5'}`}
              >
                Filters <SlidersHorizontal size={14} />
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-2 border border-brand-white/10 bg-brand-white/5 px-4 py-2 text-sm text-brand-white hover:border-brand-gold transition-colors whitespace-nowrap"
                >
                  Sort: {sortBy} <ChevronDown size={14} />
                </button>
                
                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-brand-rich-black border border-brand-white/10 shadow-2xl py-2"
                    >
                      {sortOptions.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setSortBy(opt);
                            setIsSortOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            sortBy === opt ? "text-brand-gold bg-brand-white/5" : "text-brand-white/70 hover:text-brand-white hover:bg-brand-white/5"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="p-6 bg-[#0a0a0a] border border-brand-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Shape</label>
                  <select 
                    value={activeShape}
                    onChange={(e) => setActiveShape(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors appearance-none"
                  >
                    {shapeOptions.map(opt => <option key={opt} value={opt} className="bg-brand-black">{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Length</label>
                  <select 
                    value={activeLength}
                    onChange={(e) => setActiveLength(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors appearance-none"
                  >
                    {lengthOptions.map(opt => <option key={opt} value={opt} className="bg-brand-black">{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Occasion</label>
                  <select 
                    value={activeOccasion}
                    onChange={(e) => setActiveOccasion(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors appearance-none"
                  >
                    {occasionOptions.map(opt => <option key={opt} value={opt} className="bg-brand-black">{opt}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence>
            {filteredProducts.map((product) => {
              const inWishlist = isInWishlist(product.id);
              return (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="group"
                >
                  <div className="relative aspect-[3/4] mb-4 bg-brand-dark-gray overflow-hidden cursor-pointer rounded-sm">
                    <Link href={`/product/${product.id}`} className="absolute inset-0 z-20" />
                    
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {product.images[1] && (
                      <Image
                        src={product.images[1]}
                        alt={`${product.name} alternate`}
                        fill
                        className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                      />
                    )}

                    {/* Quick actions overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-30 flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          addToCart(product);
                        }}
                        className="flex-1 bg-brand-white text-brand-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-brand-gold transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingBag size={14} /> Add
                      </button>
                    </div>

                    {/* Wishlist toggle */}
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        inWishlist ? removeFromWishlist(product.id) : addToWishlist(product);
                      }}
                      className="absolute top-4 right-4 w-8 h-8 rounded-full glass flex items-center justify-center text-brand-white hover:text-brand-gold transition-colors z-30 shadow-md"
                    >
                      <Heart size={14} fill={inWishlist ? "#D4AF37" : "transparent"} color={inWishlist ? "#D4AF37" : "currentColor"} />
                    </button>
                    
                    {/* Tags */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
                      {product.isNewArrival && (
                        <span className="bg-brand-white text-brand-black text-[9px] uppercase tracking-widest px-2 py-1 font-bold">New</span>
                      )}
                      {product.isBestSeller && (
                        <span className="bg-brand-gold text-brand-black text-[9px] uppercase tracking-widest px-2 py-1 font-bold">Best Seller</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-serif text-lg text-brand-white group-hover:text-brand-gold transition-colors">{product.name}</h3>
                      <span className="text-brand-white/80 font-light text-sm">₹{product.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-brand-white/50 text-xs">
                      <Star size={10} className="text-brand-gold fill-brand-gold" />
                      <span>{product.rating}</span>
                      <span className="ml-1">({product.reviewsCount})</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-24 text-brand-white/50">
            <p className="text-xl font-serif mb-4">No pieces found</p>
            <button 
              onClick={() => { setActiveCategory("All"); setSearchQuery(""); setActiveShape("All"); setActiveLength("All"); setActiveOccasion("All"); }}
              className="text-brand-gold underline uppercase tracking-widest text-xs"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
