
import Hero from "@/components/Hero";
import FeaturedCollections from "@/components/FeaturedCollections";
import NewArrivals from "@/components/NewArrivals";
import BestSellers from "@/components/BestSellers";
import WhyVrNails from "@/components/WhyVrNails";
import BrandStory from "@/components/BrandStory";
import LuxuryBanner from "@/components/LuxuryBanner";
import Gallery from "@/components/Gallery";
import VirtualTryOn from "@/components/VirtualTryOn";
import CustomerReviews from "@/components/CustomerReviews";
import InstagramShowcase from "@/components/InstagramShowcase";
import VipClub from "@/components/VipClub";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between w-full bg-brand-black">
      <Hero />
      <FeaturedCollections />
      <NewArrivals />
      <BestSellers />
      <WhyVrNails />
      <BrandStory />
      <LuxuryBanner />
      <Gallery />
      <VirtualTryOn />
      <CustomerReviews />
      <InstagramShowcase />
      <VipClub />

    </main>
  );
}
