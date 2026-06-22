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
}

const descriptions = {
  Bridal: "Elegance redefined for your special day. Our Bridal collection features delicate lacework, soft pearls, and a timeless white finish to complement the most important dress you will ever wear.",
  Butterfly: "Embrace ethereal beauty with hand-painted butterfly motifs, iridescent wings, and delicate crystal accents. Perfect for a whimsical, dreamy aesthetic.",
  Chrome: "A striking mirror finish that demands attention. Our Chrome collection delivers futuristic high-shine and unparalleled bold glamour.",
  Nude: "The ultimate everyday luxury. Perfectly matched to your skin tone for an elongated, sophisticated, and flawlessly natural look.",
  "Gold Luxury": "Opulence at your fingertips. Crafted with 24k gold leaf accents, premium metallic finishes, and intricate detailing for true royalty."
};

const imageMap = {
  Bridal: [
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&q=100&w=2400"
  ],
  Butterfly: [
    "https://images.unsplash.com/photo-1516975080661-46b0d91244e8?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1620002093390-1c3905e0423c?auto=format&fit=crop&q=100&w=2400"
  ],
  Chrome: [
    "https://images.unsplash.com/photo-1595868840228-5e8c13f6406e?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1595085340058-2e389df310ab?auto=format&fit=crop&q=100&w=2400"
  ],
  Nude: [
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=100&w=2400",
    "https://images.unsplash.com/photo-1595868840228-5e8c13f6406e?auto=format&fit=crop&q=100&w=2400"
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
  
  const basePrice = collection === "Gold Luxury" ? 1499 : collection === "Bridal" ? 999 : 699;
  const price = basePrice + (i * 73 % 400);
  
  const rating = 4.5 + ((i * 3 % 5) / 10); // deterministic 4.5 to 4.9
  const reviewsCount = 20 + (i * 13 % 200);

  const adjectives = ["Luminous", "Ethereal", "Midnight", "Velvet", "Royal", "Enchanted", "Signature", "Radiant", "Imperial", "Gilded"];
  const nameSuffixes = ["Stiletto", "Almond", "Coffin", "Square", "Oval"];
  const name = `${adjectives[i % adjectives.length]} ${collection} ${nameSuffixes[(i * 5) % nameSuffixes.length]}`;

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
