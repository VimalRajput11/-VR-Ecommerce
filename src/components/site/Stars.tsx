import { Star } from "lucide-react";

export default function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden className={i <= Math.round(rating) ? "fill-gold text-gold" : "text-sand"} />
      ))}
    </span>
  );
}
