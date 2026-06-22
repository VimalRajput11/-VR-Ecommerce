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
              At VR Nails, we believe that luxury is in the details. Every single press-on nail is a miniature canvas, meticulously handcrafted by expert nail artisans who share a passion for perfection.
            </p>
            <p>
              We source only the finest materials, from genuine 24k gold leaf accents to premium salon-grade gels, ensuring that your nails not only look spectacular but endure with flawless resilience.
            </p>
            <p>
              Our mission is to empower the modern, elegant woman with the ability to achieve a world-class salon finish in minutes. Because true luxury is not just about aesthetics—it is about the confidence it inspires.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
