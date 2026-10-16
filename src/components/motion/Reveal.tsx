"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// Scroll-triggered entrance animations. All motion honours the OS "reduce motion" setting
// via <MotionProvider> (MotionConfig reducedMotion="user").

const EASE = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  amount = 0.2,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  amount?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/** Children wrapped in <StaggerItem> animate in one after another. */
export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const Comp = as === "ul" ? motion.ul : as === "ol" ? motion.ol : motion.div;
  return (
    <Comp className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp className={className} variants={item}>
      {children}
    </Comp>
  );
}
