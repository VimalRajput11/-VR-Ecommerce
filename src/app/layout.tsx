import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ShopProvider } from "@/context/ShopContext";
import AuthModal from "@/components/AuthModal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VR Nails | Luxury Handmade Press-On Nails",
  description: "Crafted for Every Mood, Designed for Every Occasion. Premium handmade press-on nails for the modern elegant woman.",
  icons: {
    icon: '/favicon.png?v=2',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-brand-black text-brand-white">
        <ShopProvider>
          <Navbar />
          {children}
          <Footer />
          <AuthModal />
        </ShopProvider>
      </body>
    </html>
  );
}
