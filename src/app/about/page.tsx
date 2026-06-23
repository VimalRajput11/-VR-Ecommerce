import BrandStory from "@/components/BrandStory";

export default function AboutPage() {
  return (
    <div className="pt-20">
      <BrandStory />
      
      <section className="py-24 bg-brand-black/50 border-t border-brand-white/5">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-brand-white mb-8">
            Our <span className="gold-gradient-text italic">Philosophy</span>
          </h2>
          <div className="space-y-6 text-brand-white/80 font-light leading-relaxed">
            <p>
              At VR Nails, we believe that elegance is in the details. Every single press-on nail is a miniature canvas, meticulously handcrafted to bring you beautiful, reusable designs that you can wear with confidence.
            </p>
            <p>
              We focus on using premium quality materials to ensure that your nails not only look spectacular but endure with flawless resilience, allowing for multiple applications.
            </p>
            <p>
              Our mission is to empower the modern woman with the ability to achieve a premium, crafted look in minutes. Because true beauty is not just about aesthetics—it is about the confidence it inspires.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
