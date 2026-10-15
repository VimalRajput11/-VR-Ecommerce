import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VG Unisex Saloon | Hair, Grooming & Beauty in Old Rajendra Nagar, Delhi",
    template: "%s | VG Unisex Saloon",
  },
  description:
    "VG Unisex Saloon in Bade Bazar, Old Rajendra Nagar, Delhi — haircuts, colour, men's grooming, skin care, nail care and occasion makeup. Book your appointment online.",
  applicationName: "VG Unisex Saloon",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "VG Unisex Saloon",
    title: "VG Unisex Saloon — Your Style, Your Confidence.",
    description: "Premium unisex salon for hair, grooming, skin, nails and makeup in Old Rajendra Nagar, Delhi.",
  },
  twitter: { card: "summary_large_image", title: "VG Unisex Saloon", description: "Your Style, Your Confidence." },
};

export const viewport: Viewport = {
  themeColor: "#1b1a18",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ivory font-sans text-charcoal">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
