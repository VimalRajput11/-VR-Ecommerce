"use client";

import { useShop } from "@/context/ShopContext";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ArrowRight, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { products } from "@/lib/data";

export default function CartPage() {
  const { cart, addToCart, removeFromCart, updateQuantity, cartTotal } = useShop();
  const router = useRouter();

  const upsellItems = products.filter(p => !cart.find(c => c.id === p.id)).slice(0, 2);

  return (
    <main className="min-h-screen bg-brand-black w-full flex flex-col">

      <div className="flex-1 pt-32 px-6 md:px-12 max-w-[1400px] mx-auto w-full mb-24">
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl text-brand-white mb-2">
            Your <span className="italic gold-gradient-text">Cart</span>
          </h1>
          <p className="text-brand-white/50 text-sm">Review your selected pieces before checkout.</p>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-24 glass border border-brand-white/5 rounded-sm">
            <h2 className="font-serif text-2xl text-brand-white mb-4">Your cart is empty</h2>
            <p className="text-brand-white/50 mb-8 font-light">Explore our collections to discover your next signature look.</p>
            <Link 
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-white text-brand-black uppercase tracking-widest text-sm font-semibold hover:bg-brand-gold transition-colors rounded-sm"
            >
              Continue Shopping <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12 xl:gap-16">
            {/* Left: Cart Items */}
            <div className="w-full lg:w-2/3">
              <div className="border-b border-brand-white/10 pb-4 mb-6 hidden sm:grid grid-cols-12 gap-4 text-xs uppercase tracking-widest text-brand-white/50">
                <div className="col-span-6">Product</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right">Total</div>
              </div>

              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center py-6 border-b border-brand-white/5"
                    >
                      {/* Product Info */}
                      <div className="col-span-1 sm:col-span-6 flex gap-4">
                        <Link href={`/product/${item.id}`} className="w-24 h-32 relative bg-brand-dark-gray flex-shrink-0 group overflow-hidden rounded-sm">
                          <Image src={item.images[0]} alt={item.name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                        </Link>
                        <div className="flex flex-col justify-center">
                          <h3 className="font-serif text-lg text-brand-white mb-1">
                            <Link href={`/product/${item.id}`} className="hover:text-brand-gold transition-colors">{item.name}</Link>
                          </h3>
                          <p className="text-brand-white/50 text-xs uppercase tracking-widest mb-2">{item.collection}</p>
                          <p className="text-brand-white/70 text-sm mb-4">₹{item.price.toFixed(2)}</p>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="flex items-center gap-1 text-brand-white/40 hover:text-red-500 transition-colors text-xs uppercase tracking-widest w-fit"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-1 sm:col-span-3 flex sm:justify-center items-center">
                        <div className="flex items-center border border-brand-white/20 rounded-sm">
                          <button 
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="px-3 py-2 text-brand-white/50 hover:text-brand-gold transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-8 text-center text-brand-white text-sm">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="px-3 py-2 text-brand-white/50 hover:text-brand-gold transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Item Total */}
                      <div className="col-span-1 sm:col-span-3 sm:text-right hidden sm:block">
                        <span className="text-brand-white text-lg font-light">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Upsell Section */}
              <div className="mt-16 pt-12 border-t border-brand-white/10">
                <h4 className="text-brand-white font-serif text-xl mb-6">Complete Your Look</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {upsellItems.map(item => (
                    <div key={item.id} className="flex gap-4 p-4 border border-brand-white/10 rounded-sm bg-brand-white/5">
                      <Link href={`/product/${item.id}`} className="w-20 h-24 relative flex-shrink-0">
                        <Image src={item.images[0]} alt={item.name} fill className="object-cover rounded-sm" />
                      </Link>
                      <div className="flex flex-col justify-center flex-1">
                        <h5 className="text-brand-white text-sm font-medium mb-1">{item.name}</h5>
                        <p className="text-brand-white/50 text-xs mb-3">₹{item.price.toFixed(2)}</p>
                        <button 
                          onClick={() => {
                            addToCart(item);
                          }}
                          className="text-brand-gold text-xs uppercase tracking-widest font-semibold hover:text-brand-white transition-colors text-left"
                        >
                          + Add To Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="w-full lg:w-1/3">
              <div className="glass p-8 rounded-sm border border-brand-white/10 sticky top-32 bg-brand-black/40">
                <h2 className="font-serif text-2xl text-brand-white mb-6">Order Summary</h2>
                
                <div className="space-y-4 text-sm font-light text-brand-white/70 mb-6 pb-6 border-b border-brand-white/10">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-brand-white">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-8">
                  <span className="text-brand-white font-medium uppercase tracking-widest text-sm">Estimated Total</span>
                  <span className="text-brand-white text-2xl font-serif">₹{cartTotal.toFixed(2)}</span>
                </div>

                <button 
                  onClick={() => router.push('/checkout')}
                  className="w-full py-4 bg-brand-gold text-brand-black uppercase tracking-widest text-sm font-bold hover:bg-brand-white transition-colors flex items-center justify-center gap-2 mb-6 rounded-sm shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                >
                  Proceed To Checkout <ArrowRight size={16} />
                </button>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-brand-white/50 text-xs">
                    <ShieldCheck size={16} className="text-brand-gold" />
                    <span>Secure encrypted checkout</span>
                  </div>
                  <div className="flex items-center gap-3 text-brand-white/50 text-xs">
                    <Truck size={16} className="text-brand-gold" />
                    <span>Free shipping on orders over ₹2000</span>
                  </div>
                  <div className="flex items-center gap-3 text-brand-white/50 text-xs">
                    <RefreshCw size={16} className="text-brand-gold" />
                    <span>30-day return policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
