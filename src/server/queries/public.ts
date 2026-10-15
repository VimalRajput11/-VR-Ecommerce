import { connectDB } from "@/server/db";
import { Coupon, GalleryImage, Review, Service, ServiceCategory, type ServiceDoc } from "@/server/models";
import { CATEGORY_IMAGES } from "@/lib/images";

// Read-only queries used by public pages (server components) and public APIs.

export interface PublicService {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  kind: string;
  audience: string;
  description: string;
  durationMin: number;
  /** null when the owner has not yet verified the price */
  price: number | null;
  priceFrom: boolean;
  image: string;
  onlineBooking: boolean;
  featured: boolean;
  includes: string[];
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
}

export async function getPublicCatalog(): Promise<{ categories: PublicCategory[]; services: PublicService[] }> {
  await connectDB();
  const [cats, services] = await Promise.all([
    ServiceCategory.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
    Service.find({ active: true, archived: { $ne: true } }).sort({ order: 1, name: 1 }).lean<ServiceDoc[]>(),
  ]);
  const catMap = new Map(cats.map((c) => [String(c._id), c]));
  const nameById = new Map(services.map((s) => [String(s._id), s.name]));
  return {
    categories: cats.map((c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description ?? "",
      image: c.image || CATEGORY_IMAGES[c.slug] || "",
    })),
    services: services
      .filter((s) => catMap.has(String(s.categoryId)))
      .map((s) => {
        const cat = catMap.get(String(s.categoryId))!;
        return {
          id: String(s._id),
          name: s.name,
          slug: s.slug,
          categoryId: String(s.categoryId),
          categoryName: cat.name,
          categorySlug: cat.slug,
          kind: s.kind,
          audience: s.audience,
          description: s.description ?? "",
          durationMin: s.durationMin,
          price: s.priceVerified ? s.price : null,
          priceFrom: !!s.priceFrom,
          image: s.image || cat.image || CATEGORY_IMAGES[cat.slug] || "",
          onlineBooking: s.onlineBooking !== false,
          featured: !!s.featured,
          includes: (s.includes ?? []).map((id) => nameById.get(String(id))).filter(Boolean) as string[],
        };
      }),
  };
}

export async function getApprovedReviews(limit = 24) {
  await connectDB();
  const reviews = await Review.find({ status: "approved" }).sort({ createdAt: -1 }).limit(limit).lean();
  const [agg] = await Review.aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]);
  return {
    reviews: reviews.map((r) => ({
      id: String(r._id),
      name: r.displayName,
      rating: r.rating,
      comment: r.comment ?? "",
      services: r.services ?? [],
      reply: r.reply ?? "",
      date: r.createdAt,
    })),
    average: agg ? Math.round(agg.avg * 10) / 10 : null,
    count: agg?.count ?? 0,
  };
}

export async function getGallery(limit = 60) {
  await connectDB();
  const images = await GalleryImage.find({ active: true }).sort({ order: 1, createdAt: -1 }).limit(limit).lean();
  return images.map((g) => ({ id: String(g._id), url: g.url, alt: g.alt, caption: g.caption ?? "", category: g.category }));
}

export async function getPublicOffers() {
  await connectDB();
  const now = new Date();
  const coupons = await Coupon.find({ active: true, showOnWebsite: true, startsAt: { $lte: now }, endsAt: { $gte: now } })
    .sort({ endsAt: 1 })
    .lean();
  return coupons
    .filter((c) => !c.maxRedemptions || c.redemptions < c.maxRedemptions)
    .map((c) => ({
      id: String(c._id),
      code: c.code,
      title: c.title,
      description: c.description ?? "",
      kind: c.kind,
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minSubtotal: c.minSubtotal,
      endsAt: c.endsAt,
      firstVisitOnly: c.firstVisitOnly,
    }));
}
