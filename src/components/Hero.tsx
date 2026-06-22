"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Hero() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -100]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);

  // Mouse Parallax for image
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const rotateX = useTransform(springY, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-5deg", "5deg"]);
  const translateX = useTransform(springX, [-0.5, 0.5], [-20, 20]);
  const translateY = useTransform(springY, [-0.5, 0.5], [-20, 20]);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Floating particles
  const particles = Array.from({ length: 15 });

  return (
    <section className="relative min-h-screen w-full flex items-center overflow-hidden bg-brand-black pt-20">
      {/* Background Glow */}
      <div className="absolute top-1/2 right-1/4 w-[800px] h-[800px] bg-brand-gold/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />

      {/* Floating Particles */}
      {isClient && particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-brand-gold/40 rounded-full blur-[1px]"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            y: [null, Math.random() * -200 - 100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5,
          }}
        />
      ))}

      <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Left Side: Text */}
        <motion.div
          style={{ y: y1, opacity }}
          className="flex flex-col items-start pt-10 lg:pt-0"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-brand-gold uppercase tracking-[0.4em] text-xs md:text-sm font-semibold mb-6 flex items-center gap-4">
              <span className="w-8 h-[1px] bg-brand-gold"></span>
              VR Nails
            </h2>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-7xl text-brand-white mb-6 leading-[1.1]">
              Luxury Handmade <br />
              <span className="gold-gradient-text italic">Press-On Nails</span>
            </h1>
            <p className="text-brand-white/70 max-w-md text-sm md:text-base leading-relaxed mb-10 tracking-wide font-light">
              Crafted for elegance. Designed for confidence. Experience the ultimate premium salon finish from the comfort of your home.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto"
          >
            <Link 
              href="/shop"
              className="px-10 py-4 bg-brand-white text-brand-black font-semibold uppercase tracking-widest text-sm hover:bg-brand-gold transition-colors duration-500 w-full sm:w-auto text-center"
            >
              Shop Collection
            </Link>
            <Link 
              href="/gallery"
              className="px-10 py-4 glass text-brand-white border border-brand-white/20 font-semibold uppercase tracking-widest text-sm hover:bg-brand-white/10 hover:border-brand-gold/50 transition-all duration-500 w-full sm:w-auto text-center"
            >
              Explore Designs
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Side: 3D Visual */}
        <motion.div
          style={{ y: y2, opacity }}
          className="relative h-[60vh] lg:h-[80vh] w-full flex items-center justify-center perspective-[1000px]"
        >
          <motion.div
            style={{ 
              rotateX, 
              rotateY,
              x: translateX,
              y: translateY,
            }}
            className="relative w-full h-full max-w-[500px] max-h-[700px] transform-style-preserve-3d"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 gold-glow rounded-t-full opacity-30" />
            
            <Image
              src="/hero_tortoise.png" 
              alt="Premium Nail Visual"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-center rounded-t-full rounded-b-lg border border-brand-white/10 shadow-2xl"
              priority
            />
            
            {/* Overlay Gradient for depth */}
            <div className="absolute inset-0 rounded-t-full rounded-b-lg bg-gradient-to-t from-brand-black/80 via-transparent to-transparent" />
            
            {/* Floating element 1 */}
            <motion.div 
              className="absolute -right-10 top-1/4 glass p-4 rounded-xl hidden md:flex flex-col items-center gap-2 transform translate-z-50 border border-brand-gold/30"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden relative">
                <Image src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400" fill sizes="48px" className="object-cover" alt="Detail" />
              </div>
              <span className="text-[10px] text-brand-gold tracking-widest uppercase">24k Detail</span>
            </motion.div>

            {/* Floating element 2 */}
            <motion.div 
              className="absolute -left-8 bottom-1/4 glass px-6 py-3 rounded-lg hidden md:flex items-center gap-3 transform translate-z-50 border border-brand-white/10"
              animate={{ y: [0, 15, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <span className="text-xl">✨</span>
              <span className="text-[10px] text-brand-white tracking-widest uppercase">Premium Finish</span>
            </motion.div>

          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
