/**
 * Development/initial seed for VG Unisex Salon.
 *
 *   npm run seed
 *
 * - Creates the business settings document (if missing) and syncs all indexes.
 * - Adds the suggested service categories and services ONLY when they don't exist yet.
 *   Prices are clearly marked as unverified samples: they are hidden on the public site
 *   ("Price confirmed at the salon") until the owner edits and verifies each one.
 * - Never creates customers, bookings, payments, or reviews.
 */
import mongoose from "mongoose";

try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

async function main() {
  const { connectDB, disconnectDB } = await import("../src/server/db");
  const models = await import("../src/server/models");
  const { getSettings } = await import("../src/server/services/settings");
  await connectDB();
  console.log(`Connected to ${mongoose.connection.name}`);

  for (const model of Object.values(models)) {
    if (typeof model === "function" && "syncIndexes" in model) await (model as unknown as mongoose.Model<unknown>).syncIndexes();
  }
  console.log("Indexes synced.");
  await getSettings();
  console.log("Business settings ready.");

  type Seed = {
    name: string;
    durationMin: number;
    price: number; // rupees (sample)
    priceFrom?: boolean;
    audience?: "unisex" | "men" | "women" | "kids";
    description: string;
    kind?: "service" | "package";
    onlineBooking?: boolean;
    active?: boolean;
    featured?: boolean;
    bufferMin?: number;
  };

  const catalogue: { name: string; slug: string; description: string; services: Seed[] }[] = [
    {
      name: "Hair Services",
      slug: "hair-services",
      description: "Cuts, styling, colour and care for every hair type.",
      services: [
        { name: "Men's Haircut", durationMin: 30, price: 300, audience: "men", featured: true, description: "Consultation, precision cut and finish styled to suit you." },
        { name: "Women's Haircut", durationMin: 45, price: 600, audience: "women", featured: true, description: "Consultation, wash, cut and blow-dry finish." },
        { name: "Kids' Haircut", durationMin: 30, price: 250, audience: "kids", description: "A gentle, quick cut for children under 12." },
        { name: "Hair Wash & Blow-Dry", durationMin: 45, price: 500, description: "Cleanse, condition and a smooth, bouncy blow-dry." },
        { name: "Hair Styling", durationMin: 45, price: 700, description: "Curls, waves or sleek styles for everyday or occasions." },
        { name: "Hair Straightening & Smoothing", durationMin: 180, price: 4000, priceFrom: true, bufferMin: 15, description: "Long-lasting smoothness and frizz control. Price depends on hair length." },
        { name: "Hair Spa", durationMin: 60, price: 1200, featured: true, description: "Deep-conditioning ritual with scalp massage to restore shine." },
        { name: "Hair Treatment", durationMin: 90, price: 2500, priceFrom: true, description: "Repair and strengthening treatments tailored to your hair's needs." },
        { name: "Hair Colouring", durationMin: 90, price: 1500, priceFrom: true, bufferMin: 10, description: "Root touch-up or all-over colour with a professional finish." },
        { name: "Highlights & Global Colour", durationMin: 150, price: 3500, priceFrom: true, bufferMin: 15, description: "Dimensional highlights or a full global colour transformation." },
      ],
    },
    {
      name: "Men's Grooming",
      slug: "mens-grooming",
      description: "Sharp, clean grooming for beards, shaves and more.",
      services: [
        { name: "Beard Trim", durationMin: 20, price: 150, audience: "men", description: "Shape and tidy your beard with a clean outline." },
        { name: "Beard Styling", durationMin: 30, price: 250, audience: "men", description: "Detailed beard design, line-up and finishing." },
        { name: "Classic Shave", durationMin: 30, price: 200, audience: "men", description: "Hot towel, smooth shave and soothing aftercare." },
        { name: "Haircut & Beard Combo", durationMin: 45, price: 400, audience: "men", featured: true, description: "Haircut plus beard trim and styling in one visit." },
        { name: "Men's Grooming Package", durationMin: 90, price: 1200, audience: "men", kind: "package", description: "Haircut, beard styling and a refreshing face cleanup." },
      ],
    },
    {
      name: "Skin & Beauty",
      slug: "skin-beauty",
      description: "Facials, clean-ups and beauty essentials for glowing skin.",
      services: [
        { name: "Facial", durationMin: 60, price: 1500, priceFrom: true, featured: true, description: "Cleanse, exfoliate, massage and mask for radiant skin." },
        { name: "Clean-Up", durationMin: 45, price: 700, description: "A quick refresh that clears and brightens the skin." },
        { name: "De-Tan Treatment", durationMin: 45, price: 800, description: "Reduces sun tan and evens out skin tone." },
        { name: "Skincare Treatment", durationMin: 60, price: 2000, priceFrom: true, description: "Targeted care for specific skin concerns after consultation." },
        { name: "Threading", durationMin: 15, price: 60, description: "Precise threading for eyebrows, upper lip or face." },
        { name: "Waxing", durationMin: 30, price: 400, priceFrom: true, description: "Smooth, long-lasting hair removal. Price depends on area." },
        { name: "Eyebrow Shaping", durationMin: 20, price: 100, description: "Brow mapping and shaping to frame your face." },
      ],
    },
    {
      name: "Nail Care",
      slug: "nail-care",
      description: "Hand and foot care, from basics to finishing touches.",
      services: [
        { name: "Manicure", durationMin: 45, price: 600, description: "Nail shaping, cuticle care, hand massage and polish." },
        { name: "Pedicure", durationMin: 60, price: 800, description: "Soak, scrub, nail care and a relaxing foot massage." },
        { name: "Nail Cleaning & Basic Care", durationMin: 30, price: 300, description: "Clean, trim and shape for neat, healthy nails." },
        { name: "Nail Art", durationMin: 45, price: 700, priceFrom: true, active: false, description: "Creative nail designs. Enable this service only if it is offered." },
      ],
    },
    {
      name: "Makeup & Occasions",
      slug: "makeup-occasions",
      description: "Makeup and styling for parties, engagements and weddings.",
      services: [
        { name: "Party Makeup", durationMin: 75, price: 2500, priceFrom: true, featured: true, description: "A polished, long-wearing look for celebrations." },
        { name: "Engagement Makeup", durationMin: 120, price: 6000, priceFrom: true, description: "Camera-ready makeup and styling for your engagement." },
        { name: "Bridal Makeup", durationMin: 180, price: 15000, priceFrom: true, onlineBooking: false, description: "Complete bridal look. Please contact the salon for a consultation." },
        { name: "Groom Makeup", durationMin: 60, price: 3000, priceFrom: true, audience: "men", description: "Natural grooming and makeup for the groom." },
        { name: "Event Hairstyling", durationMin: 60, price: 1500, priceFrom: true, description: "Updos, braids and styled looks for special events." },
      ],
    },
    {
      name: "Packages",
      slug: "packages",
      description: "Combined services for more value in a single visit.",
      services: [
        { name: "Haircut & Grooming Combo", durationMin: 75, price: 900, kind: "package", description: "Haircut with beard or brow grooming and a quick clean-up." },
        { name: "Hair & Skin Care Package", durationMin: 105, price: 1800, kind: "package", featured: true, description: "Hair spa together with a refreshing clean-up." },
        { name: "Pre-Bridal Package", durationMin: 240, price: 12000, priceFrom: true, kind: "package", onlineBooking: false, description: "Multi-session pre-wedding care. Contact the salon to plan your sessions." },
        { name: "Bridal & Groom Package", durationMin: 240, price: 20000, priceFrom: true, kind: "package", onlineBooking: false, description: "Coordinated looks for the couple. Consultation required." },
        { name: "Festival Glow Package", durationMin: 120, price: 2500, kind: "package", active: false, description: "Seasonal festive package. Activate during festival offers." },
      ],
    },
  ];

  const slugify = (v: string) => v.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let createdCats = 0;
  let createdServices = 0;
  for (const [ci, cat] of catalogue.entries()) {
    let category = await models.ServiceCategory.findOne({ slug: cat.slug });
    if (!category) {
      category = await models.ServiceCategory.create({ name: cat.name, slug: cat.slug, description: cat.description, order: ci });
      createdCats++;
    }
    for (const [si, s] of cat.services.entries()) {
      const slug = slugify(s.name);
      if (await models.Service.exists({ slug })) continue;
      await models.Service.create({
        name: s.name,
        slug,
        categoryId: category._id,
        kind: s.kind ?? "service",
        audience: s.audience ?? "unisex",
        description: s.description,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin ?? 0,
        price: s.price * 100,
        priceFrom: !!s.priceFrom,
        priceVerified: false, // SAMPLE PRICE — owner must verify before it is shown publicly
        onlineBooking: s.onlineBooking ?? true,
        active: s.active ?? true,
        featured: !!s.featured,
        order: si,
      });
      createdServices++;
    }
  }
  console.log(`Catalogue: ${createdCats} categories and ${createdServices} services added (existing records untouched).`);
  console.log("NOTE: all seeded prices are unverified samples. Review them in Dashboard → Services before launch.");
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
