export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  rating: number;
  reviewsCount: number;
  collection: "Bridal" | "Butterfly" | "Chrome" | "Nude" | "Gold Luxury";
  images: string[];
  reviews: Review[];
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  shape?: string;
  length?: string;
  occasion?: string;
}

const descriptions = {
  Bridal: "Elegant designs created for weddings and special occasions.",
  Butterfly: "Inspired by delicate artistic details.",
  Chrome: "Modern metallic finishes with a premium look.",
  Nude: "Perfectly matched to your skin tone for an everyday natural look.",
  "Gold Luxury": "Crafted with attention to detail, premium metallic finishes for an elegant statement."
};

const imageMap = {
  Bridal: [
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
  ],
  Butterfly: [
    "https://images.unsplash.com/photo-1516975080661-46b0d91244e8?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
  ],
  Chrome: [
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400"
  ],
  Nude: [
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400"
  ],
  "Gold Luxury": [
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
  ]
};

// Generate 30 realistic dummy products
export const products: Product[] = Array.from({ length: 30 }).map((_, i) => {
  const collections = ["Bridal", "Butterfly", "Chrome", "Nude", "Gold Luxury"] as const;
  const collection = collections[i % collections.length];
  
  const basePrices = [799, 999, 1199, 1299, 1499, 1799];
  const priceIndex = (collection === "Gold Luxury" ? 4 : collection === "Bridal" ? 3 : collection === "Chrome" ? 2 : collection === "Butterfly" ? 1 : 0) + (i % 2);
  const price = basePrices[Math.min(priceIndex, basePrices.length - 1)];
  
  const rating = 4.5 + ((i * 3 % 5) / 10); // deterministic 4.5 to 4.9
  const reviewsCount = 20 + (i * 13 % 200);

  const adjectives = ["Luminous", "Ethereal", "Midnight", "Velvet", "Royal", "Enchanted", "Signature", "Radiant", "Imperial", "Gilded"];
  const nameSuffixes = ["Stiletto", "Almond", "Coffin", "Square", "Oval"];
  const name = `${adjectives[i % adjectives.length]} ${collection} ${nameSuffixes[(i * 5) % nameSuffixes.length]}`;

  const lengths = ["Short", "Medium", "Long", "Extra Long"];
  const occasions = ["Everyday", "Wedding", "Party", "Vacation"];
  const shape = nameSuffixes[(i * 5) % nameSuffixes.length];

  return {
    id: `prod-${i + 1}`,
    name,
    price,
    description: descriptions[collection],
    rating: parseFloat(rating.toFixed(1)),
    reviewsCount,
    collection,
    images: imageMap[collection],
    isNewArrival: i < 5,
    isBestSeller: i % 4 === 0,
    shape,
    length: lengths[i % lengths.length],
    occasion: occasions[i % occasions.length],
    reviews: [
      {
        id: `rev-${i}-1`,
        author: ["Priya S.", "Anjali T.", "Neha R.", "Kavya B.", "Aarti W."][i % 5],
        rating: 5,
        text: "Absolutely stunning! The quality is incredible and they look so natural. Will definitely be ordering more.",
        date: "2024-03-15"
      },
      {
        id: `rev-${i}-2`,
        author: ["Riya G.", "Sneha L.", "Ishita H.", "Meera C.", "Simran N."][i % 5],
        rating: 4,
        text: "Beautiful packaging and the nails feel very premium. Just make sure you measure your sizes correctly.",
        date: "2024-02-28"
      }
    ]
  };
});

export const featuredCollections = [
  { name: "Bridal Collection", image: imageMap["Bridal"][0] },
  { name: "Chrome Collection", image: imageMap["Chrome"][0] },
  { name: "Butterfly Collection", image: imageMap["Butterfly"][0] },
  { name: "Nude Luxury Collection", image: imageMap["Nude"][0] },
  { name: "Gold Signature Collection", image: imageMap["Gold Luxury"][0] },
];

export const collections = [
  { id: "bridal", name: "Bridal Collection", image: imageMap["Bridal"][0], description: descriptions["Bridal"] },
  { id: "chrome", name: "Chrome Collection", image: imageMap["Chrome"][0], description: descriptions["Chrome"] },
  { id: "butterfly", name: "Butterfly Collection", image: imageMap["Butterfly"][0], description: descriptions["Butterfly"] },
  { id: "nude", name: "Nude Luxury Collection", image: imageMap["Nude"][0], description: descriptions["Nude"] },
  { id: "gold", name: "Gold Signature Collection", image: imageMap["Gold Luxury"][0], description: descriptions["Gold Luxury"] },
];
