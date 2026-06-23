"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingBag, Menu, X, Heart, User, Search, Lock, ChevronRight } from "lucide-react";
import { useShop } from "@/context/ShopContext";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { cart, wishlist, setIsCartOpen, setIsAuthModalOpen } = useShop();
  const pathname = usePathname();

  const isShopOrProduct = pathname?.startsWith("/shop") || pathname?.startsWith("/product");
  const isCart = pathname === "/cart";
  const isCheckout = pathname === "/checkout";
  const isOrderSuccess = pathname === "/order-success";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Collections", href: "/collections" },
    { name: "Shop", href: "/shop" },
    { name: "Gallery", href: "/gallery" },
    { name: "Contact", href: "/contact" },
    { name: "About", href: "/about" },
  ];

  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Background style logic
  let headerClasses = "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ";
  if (isCheckout || isOrderSuccess || isCart || isShopOrProduct || isScrolled) {
    headerClasses += "bg-brand-black/95 backdrop-blur-md border-b border-brand-gold/20 py-4";
  } else {
    headerClasses += "bg-transparent py-6";
  }

  // --- CHECKOUT NAVBAR ---
  if (isCheckout) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-brand-black border-b border-brand-white/10 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Image src="/vr_logo.png" alt="VR Nails Logo" fill className="object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-2 text-brand-gold text-sm tracking-widest uppercase font-medium">
            <Lock size={16} /> Secure Checkout
          </div>
        </div>
      </header>
    );
  }

  // --- ORDER SUCCESS NAVBAR ---
  if (isOrderSuccess) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-brand-black border-b border-brand-white/10 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Image src="/vr_logo.png" alt="VR Nails Logo" fill className="object-contain" />
            </div>
          </Link>
          <Link href="/shop" className="text-brand-white hover:text-brand-gold transition-colors uppercase tracking-widest text-xs flex items-center gap-2">
            Continue Shopping <ChevronRight size={14} />
          </Link>
        </div>
      </header>
    );
  }

  // --- CART NAVBAR ---
  if (isCart) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-brand-black/95 backdrop-blur-md border-b border-brand-gold/20 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Image src="/vr_logo.png" alt="VR Nails Logo" fill className="object-contain mix-blend-screen" />
            </div>
          </Link>
          <Link href="/cart" className="relative text-brand-gold">
            <ShoppingBag size={24} strokeWidth={1.5} />
            {cartItemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand-white text-brand-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>
    );
  }

  // --- MAIN NAVBAR (Home, Shop, Product, About, Gallery) ---
  return (
    <>
      <motion.header
        className={headerClasses}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center z-50">
            <div className="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
              <Image 
                src="/vr_logo.png" 
                alt="VR Nails Logo" 
                fill 
                className="object-contain mix-blend-screen"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden text-center">
                <span className="block text-brand-white font-serif text-xl tracking-widest">VR</span>
              </div>
            </div>
          </Link>

          {/* Center: Desktop Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs tracking-[0.2em] uppercase">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="relative group overflow-hidden py-2">
                <span className="text-brand-white group-hover:text-brand-gold transition-colors duration-500">
                  {link.name}
                </span>
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-brand-gold -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />
              </Link>
            ))}
          </nav>

          {/* Right: Icons */}
          <div className="flex items-center gap-5 md:gap-6 z-50">

            
            <Link href="/wishlist" className="relative text-brand-white hover:text-brand-gold transition-colors duration-500">
              <Heart size={20} strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-gold text-brand-black text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link href="/cart" className="relative text-brand-white hover:text-brand-gold transition-colors duration-500">
              <ShoppingBag size={20} strokeWidth={1.5} />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-brand-gold text-brand-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>

            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="hidden md:block text-brand-white hover:text-brand-gold transition-colors duration-500"
            >
              <User size={20} strokeWidth={1.5} />
            </button>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-brand-white hover:text-brand-gold transition-colors relative w-6 h-6 flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X size={24} strokeWidth={1.5} />
              ) : (
                <Menu size={24} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Full Screen Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-brand-black z-40 lg:hidden flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center justify-center gap-8 w-full px-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (i * 0.1), duration: 0.5 }}
                >
                  <Link 
                    href={link.href} 
                    className="font-serif text-3xl md:text-4xl text-brand-white hover:text-brand-gold transition-colors italic block"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex justify-center gap-8 mt-12 pt-12 border-t border-brand-white/10 w-3/4"
              >

                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }} 
                  className="text-brand-white/50 hover:text-brand-gold flex flex-col items-center gap-2"
                >
                  <User size={24} strokeWidth={1} />
                  <span className="text-[10px] uppercase tracking-widest">Sign In</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
