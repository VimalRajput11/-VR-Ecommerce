"use client";

import { useState } from "react";
import { useShop } from "@/context/ShopContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useShop();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  // In a real app, we'd handle form state properly
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      clearCart();
      router.push('/order-success');
    }, 2000);
  };

  const shipping = 15.00;
  const taxes = cartTotal * 0.08;
  const total = cartTotal + shipping + taxes;

  if (cart.length === 0 && !isProcessing) {
    return (
      <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center text-brand-white p-6">
        <h1 className="font-serif text-3xl mb-4">Your cart is empty</h1>
        <Link href="/shop" className="text-brand-gold uppercase tracking-widest text-sm hover:underline">Return to Shop</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-24 bg-brand-black text-brand-white w-full flex flex-col md:flex-row">
      {/* Left side: Form */}
      <div className="w-full md:w-[55%] lg:w-[60%] flex justify-end">
        <div className="w-full max-w-[750px] p-8 md:p-12 lg:p-16">


          <div className="flex items-center gap-2 text-sm text-brand-white/50 mb-10">
            <Link href="/cart" className="hover:text-brand-gold transition-colors flex items-center gap-1">
              <ChevronLeft size={16} /> Return to Cart
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Contact */}
            <section className="mb-12">
              <h2 className="font-serif text-2xl mb-6">Contact Information</h2>
              <input 
                type="email" 
                placeholder="Email address" 
                required
                className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors mb-4"
              />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="offers" className="accent-brand-gold bg-transparent border border-brand-white/20" />
                <label htmlFor="offers" className="text-sm text-brand-white/70 font-light">Email me with exclusive news and offers</label>
              </div>
            </section>

            {/* Shipping */}
            <section className="mb-12">
              <h2 className="font-serif text-2xl mb-6">Shipping Address</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input type="text" placeholder="First name" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                <input type="text" placeholder="Last name" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
              </div>
              <input type="text" placeholder="Address" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors mb-4" />
              <input type="text" placeholder="Apartment, suite, etc. (optional)" className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors mb-4" />
              <div className="grid grid-cols-3 gap-4 mb-4">
                <input type="text" placeholder="City" required className="col-span-1 w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                <select className="col-span-1 w-full p-4 bg-[#0A0A0A] border border-brand-white/20 text-brand-white rounded-sm focus:outline-none focus:border-brand-gold transition-colors appearance-none">
                  <option value="">State</option>
                  <option value="NY">New York</option>
                  <option value="CA">California</option>
                  <option value="TX">Texas</option>
                </select>
                <input type="text" placeholder="ZIP code" required className="col-span-1 w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
              </div>
            </section>

            {/* Payment */}
            <section className="mb-12">
              <h2 className="font-serif text-2xl mb-2">Payment</h2>
              <p className="text-brand-white/50 text-sm mb-6 flex items-center gap-2"><Lock size={14} /> All transactions are secure and encrypted.</p>
              
              <div className="border border-brand-white/20 rounded-sm overflow-hidden bg-[#0A0A0A]">
                <div className="p-4 border-b border-brand-white/20 bg-brand-white/5 flex items-center gap-3">
                  <input type="radio" id="cc" name="payment" defaultChecked className="accent-brand-gold" />
                  <label htmlFor="cc" className="font-medium text-brand-white">Credit Card</label>
                </div>
                <div className="p-6 space-y-4">
                  <input type="text" placeholder="Card number" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Expiration date (MM/YY)" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                    <input type="text" placeholder="Security code" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                  </div>
                  <input type="text" placeholder="Name on card" required className="w-full p-4 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors" />
                </div>
              </div>
            </section>

            <button 
              type="submit" 
              disabled={isProcessing}
              className="w-full py-5 bg-brand-gold text-brand-black uppercase tracking-widest text-sm font-bold hover:bg-[#F5E7A1] transition-colors rounded-sm flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <Lock size={16} /> Pay ₹{total.toFixed(2)}
                </>
              )}
            </button>
            
            <p className="text-center text-xs text-brand-white/40 mt-6 flex justify-center items-center gap-1">
              <ShieldCheck size={14} /> Guaranteed safe & secure checkout
            </p>
          </form>
        </div>
      </div>

      {/* Right side: Order Summary */}
      <div className="w-full md:w-[45%] lg:w-[40%] bg-[#0A0A0A] border-l border-brand-white/10">
        <div className="w-full max-w-[550px] p-8 md:p-12 lg:p-16 lg:sticky lg:top-24 h-full lg:h-[calc(100vh-6rem)] overflow-y-auto hide-scrollbar">
          
          <div className="space-y-6 mb-8 border-b border-brand-white/10 pb-8">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 items-center">
                <div className="relative w-16 h-16 rounded-sm overflow-hidden border border-brand-white/20 flex-shrink-0 bg-brand-black">
                  <Image src={item.images[0]} alt={item.name} fill className="object-cover" />
                  <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-black w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-brand-white">{item.name}</h4>
                  <p className="text-xs text-brand-gold">{item.collection}</p>
                </div>
                <span className="text-sm text-brand-white font-light">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4 mb-8 border-b border-brand-white/10 pb-8">
            <div className="flex gap-2">
              <input type="text" placeholder="Gift card or discount code" className="flex-1 p-3 bg-transparent border border-brand-white/20 text-brand-white placeholder-brand-white/40 rounded-sm focus:outline-none focus:border-brand-gold transition-colors text-sm" />
              <button className="px-4 py-3 bg-brand-white/10 text-brand-white text-sm font-medium rounded-sm hover:bg-brand-white/20 transition-colors">Apply</button>
            </div>
          </div>

          <div className="space-y-3 text-sm font-light text-brand-white/70 mb-6">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-brand-white font-medium">₹{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="text-brand-white font-medium">₹{shipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes</span>
              <span className="text-brand-white font-medium">₹{taxes.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-brand-white/10">
            <span className="text-base font-medium text-brand-white">Total</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-white/50">INR</span>
              <span className="text-3xl font-serif gold-gradient-text">₹{total.toFixed(2)}</span>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
