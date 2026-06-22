"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ 
        duration: 0.4, 
        ease: [0.16, 1, 0.3, 1]
      }}
      className="w-full flex-grow flex flex-col"
    >
      {children}
    </motion.div>
  );
}
