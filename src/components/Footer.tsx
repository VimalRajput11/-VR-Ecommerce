"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";

const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/checkout") return null;

  return (
    <footer className="bg-brand-black text-brand-white pt-24 pb-12 px-6 md:px-12 border-t border-brand-white/10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        
        {/* Brand */}
        <div className="md:col-span-1">
          <Link href="/" className="block mb-6 relative w-20 h-20">
            <Image 
              src="/logo.png" 
              alt="VR Nails Logo" 
              fill 
              className="object-contain mix-blend-screen"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden text-left">
              <span className="block text-brand-white font-serif text-2xl tracking-widest">VR</span>
            </div>
          </Link>
          <p className="text-brand-white/50 text-sm font-light leading-relaxed mb-8 pr-4">
            Luxury handmade press-on nails for the modern elegant woman. Crafted with passion, worn with confidence.
          </p>
          <div className="flex gap-5">
            <Link href="https://instagram.com" target="_blank" className="text-brand-white/70 hover:text-brand-gold transition-colors">
              <InstagramIcon size={20} strokeWidth={1.5} />
            </Link>
            <Link href="https://wa.me/" target="_blank" className="text-brand-white/70 hover:text-brand-gold transition-colors">
              <MessageCircle size={20} strokeWidth={1.5} />
            </Link>
            <Link href="mailto:hello@vrnails.com" className="text-brand-white/70 hover:text-brand-gold transition-colors">
              <Mail size={20} strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-brand-gold uppercase tracking-widest text-xs font-semibold mb-8">Shop</h4>
          <ul className="space-y-4 text-brand-white/70 text-sm font-light">
            <li><Link href="/shop" className="hover:text-brand-gold transition-colors">All Collections</Link></li>
            <li><Link href="/shop?filter=best-sellers" className="hover:text-brand-gold transition-colors">Best Sellers</Link></li>
            <li><Link href="/collections/bridal" className="hover:text-brand-gold transition-colors">Bridal Collection</Link></li>
            <li><Link href="/custom-order" className="hover:text-brand-gold transition-colors">Custom Orders</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-brand-gold uppercase tracking-widest text-xs font-semibold mb-8">Support</h4>
          <ul className="space-y-4 text-brand-white/70 text-sm font-light">
            <li><Link href="/faq" className="hover:text-brand-gold transition-colors">FAQ</Link></li>
            <li><Link href="/shipping" className="hover:text-brand-gold transition-colors">Shipping & Returns</Link></li>
            <li><Link href="/size-guide" className="hover:text-brand-gold transition-colors">Sizing Guide</Link></li>
            <li><Link href="/contact" className="hover:text-brand-gold transition-colors">Contact Us</Link></li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-brand-gold uppercase tracking-widest text-xs font-semibold mb-8">Contact</h4>
          <ul className="space-y-4 text-brand-white/70 text-sm font-light">
            <li className="flex gap-2">
              <span className="font-semibold text-brand-white">Email:</span> hello@vrnails.com
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-brand-white">WhatsApp:</span> +1 (555) 123-4567
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-brand-white">Hours:</span> Mon-Fri, 9am - 6pm EST
            </li>
          </ul>
        </div>

      </div>

      <div className="max-w-7xl mx-auto border-t border-brand-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-light text-brand-white/40">
        <p>&copy; {new Date().getFullYear()} VR Nails. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-brand-gold transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-brand-gold transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
