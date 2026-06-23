"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User as UserIcon } from "lucide-react";
import { useShop } from "@/context/ShopContext";

export default function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen } = useShop();
  const [isLogin, setIsLogin] = useState(true);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-black/80 backdrop-blur-md px-4"
        onClick={() => setIsAuthModalOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md p-8 md:p-10 glass border border-brand-white/10 rounded-sm bg-brand-black/40 shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-6 right-6 text-brand-white/50 hover:text-brand-gold transition-colors"
          >
            <X size={24} strokeWidth={1.5} />
          </button>

          <div className="mb-8 text-center">
            <h2 className="font-serif text-3xl text-brand-white mb-2">
              {isLogin ? "Welcome Back" : "Join VR Nails"}
            </h2>
            <p className="text-brand-white/60 text-sm font-light">
              {isLogin 
                ? "Enter your details to access your luxury account." 
                : "Create an account for an exclusive shopping experience."}
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
            {!isLogin && (
              <div className="relative">
                <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-white/40" />
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="w-full bg-transparent border border-brand-white/20 rounded-sm py-3 pl-12 pr-4 text-brand-white focus:outline-none focus:border-brand-gold transition-colors font-light text-sm"
                  required
                />
              </div>
            )}
            
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-white/40" />
              <input 
                type="email" 
                placeholder="Email Address" 
                className="w-full bg-transparent border border-brand-white/20 rounded-sm py-3 pl-12 pr-4 text-brand-white focus:outline-none focus:border-brand-gold transition-colors font-light text-sm"
                required
              />
            </div>
            
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-white/40" />
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full bg-transparent border border-brand-white/20 rounded-sm py-3 pl-12 pr-4 text-brand-white focus:outline-none focus:border-brand-gold transition-colors font-light text-sm"
                required
              />
            </div>

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" className="text-xs text-brand-white/60 hover:text-brand-gold transition-colors">
                  Forgot Password?
                </button>
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-4 mt-2 bg-brand-white text-brand-black uppercase tracking-widest text-xs font-semibold hover:bg-brand-gold transition-colors duration-300"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-brand-white/60 font-light">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-brand-gold hover:text-brand-white transition-colors"
            >
              {isLogin ? "Register here" : "Sign in here"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
