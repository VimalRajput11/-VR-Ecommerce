"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const reviews = [
  {
    id: 1,
    name: "Priya S.",
    photo: "https://images.unsplash.com/photo-1524638431109-93d95c968f03?auto=format&fit=crop&q=100&w=2400",
    rating: 5,
    review: "I have worn luxury nails for years, but nothing compares to VR Nails. The craftsmanship is flawless, the gold accents are real, and they truly look like a ₹5000 salon visit. Absolute perfection.",
  },
  {
    id: 2,
    name: "Anjali T.",
    photo: "https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?auto=format&fit=crop&q=100&w=2400",
    rating: 5,
    review: "The Nude Luxury collection perfectly matched my skin tone. I wore them for my wedding and received endless compliments. They felt incredibly secure and comfortable all day.",
  },
  {
    id: 3,
    name: "Neha R.",
    photo: "https://images.unsplash.com/photo-1614204424926-196a80bf0be8?auto=format&fit=crop&q=100&w=2400",
    rating: 5,
    review: "Stunning is an understatement. The packaging alone feels like you're opening fine jewelry. The Chrome set I bought is durable, striking, and absolutely premium.",
  }
];

export default function CustomerReviews() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % reviews.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);

  return (
    <section className="py-24 px-6 md:px-12 bg-brand-black w-full overflow-hidden relative border-t border-brand-white/5">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-brand-gold/5 blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-brand-gold uppercase tracking-[0.4em] text-xs font-semibold mb-4 block"
          >
            The Experience
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl text-brand-white"
          >
            Client <span className="italic gold-gradient-text">Testimonials</span>
          </motion.h2>
        </div>

        <div className="relative h-[350px] md:h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full"
            >
              <div className="glass p-8 md:p-12 rounded-sm border border-brand-white/5 h-full flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left bg-brand-black/40 shadow-[0_0_30px_rgba(212,175,55,0.05)]">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden flex-shrink-0 border-2 border-brand-gold/30">
                  <Image 
                    src={reviews[currentIndex].photo}
                    alt={reviews[currentIndex].name}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full grayscale-[20%]"
                  />
                </div>
                
                <div className="flex-1 flex flex-col justify-center h-full">
                  <div className="flex justify-center md:justify-start gap-1 mb-4">
                    {[...Array(reviews[currentIndex].rating)].map((_, i) => (
                      <Star key={i} size={16} className="text-brand-gold fill-brand-gold" />
                    ))}
                  </div>
                  <p className="text-brand-white/90 text-lg md:text-xl font-light italic mb-6 leading-relaxed">
                    "{reviews[currentIndex].review}"
                  </p>
                  <div>
                    <h4 className="font-serif text-brand-white text-lg">{reviews[currentIndex].name}</h4>
                    <span className="text-brand-gold/70 text-xs uppercase tracking-[0.2em]">Verified Buyer</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <button 
            onClick={handlePrev}
            className="absolute left-0 md:-left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass border border-brand-white/10 flex items-center justify-center text-brand-white hover:text-brand-gold hover:border-brand-gold transition-colors z-20"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-0 md:-right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass border border-brand-white/10 flex items-center justify-center text-brand-white hover:text-brand-gold hover:border-brand-gold transition-colors z-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
