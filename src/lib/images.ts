// Decorative/brand imagery featuring Indian clients and stylists. Photos are from Unsplash
// (free under the Unsplash License) and are stored in /public/images so the site doesn't depend
// on Unsplash being fast or available. They are not presented as the salon's own work; the
// Gallery page shows owner-uploaded images. The Unsplash photo ID is noted for each.

const local = (name: string) => `/images/${name}.jpg`;

export const IMAGES = {
  // Hair
  bridalHair: local("bridalHair"), // stylist finishing a bridal updo — unsplash 1672788725446-c303ec2b318e
  heroPortrait: local("heroPortrait"), // portrait crop of bridalHair for the home hero arch (1200x1600)
  bridalHairBack: local("bridalHairBack"), // bride's styled hair, green lehenga — unsplash 1743144580426-970faf79f1d9
  hairBrushing: local("hairBrushing"), // stylist brushing a smiling client's hair — unsplash 1636342686573-2dd5b47d5ff0
  updo: local("updo"), // hands pinning an updo — unsplash 1709136331829-033933e1913d
  // Men's grooming
  mensSalon: local("mensSalon"), // barber cutting hair in a modern salon — unsplash 1593702282967-96c9f195befa
  mensCut: local("mensCut"), // barber styling a client's hair — unsplash 1635273051368-de31ef6a8cc4
  beard: local("beard"), // beard trim — unsplash 1659355751282-5ca7807af9e9
  // Skin & beauty
  facialWoman: local("facialWoman"), // woman receiving a facial — unsplash 1731355771317-b2ab72c79124
  facialMan: local("facialMan"), // man with a facial mask — unsplash 1728949202477-bad2935775cb
  // Makeup & bridal
  makeupArtist: local("makeupArtist"), // makeup artist doing bridal makeup (Kolkata) — unsplash 1638628064365-f08ad0ec8245
  bride: local("bride"), // bride in red with gold jewellery — unsplash 1600685890506-593fdf55949b
  brideSmile: local("brideSmile"), // smiling woman in traditional jewellery — unsplash 1756483560049-e7b2208f99a0
  // Nails & mehndi
  manicure: local("manicure"), // pink manicure with mehndi — unsplash 1598111252257-b1f02878dd4b
  mehndi: local("mehndi"), // bridal mehndi with gold bangles — unsplash 1762162089047-97e09435984d
  henna: local("henna"), // henna-painted hands — unsplash 1676134358843-da10f130ad04
  // More looks
  groom: local("groom"), // groom in a sherwani and safa — unsplash 1759906766080-82b785c61f51
  couple: local("couple"), // bride and groom — unsplash 1722952934708-749c22eb2e58
  kid: local("kid"), // smiling boy with a fresh cut — unsplash 1639566420586-1b6d3d295f88
  mirrorBride: local("mirrorBride"), // woman in a red sari at the mirror — unsplash 1786372546623-16607be29e54
  partyLook: local("partyLook"), // woman in a lehenga at the mirror — unsplash 1767790693504-ec30005c0ac1
  festive: local("festive"), // festive bridal look with garland — unsplash 1769103694942-1acd407a3a73
  shave: local("shave"), // smiling client mid-shave — unsplash 1561719205-2f720fe7a7f3
  wetHair: local("wetHair"), // freshly washed hair — unsplash 1723879371824-dfd4bd34d1f6
} as const;

/** Specific photo for each seeded service (by slug), so cards in a category don't repeat. */
export const SERVICE_IMAGES: Record<string, string> = {
  "mens-haircut": IMAGES.mensCut,
  "womens-haircut": IMAGES.hairBrushing,
  "kids-haircut": IMAGES.kid,
  "hair-wash-blow-dry": IMAGES.wetHair,
  "hair-styling": IMAGES.bridalHair,
  "hair-straightening-smoothing": IMAGES.bridalHairBack,
  "hair-spa": IMAGES.updo,
  "hair-treatment": IMAGES.wetHair,
  "hair-colouring": IMAGES.bridalHairBack,
  "highlights-global-colour": IMAGES.partyLook,
  "beard-trim": IMAGES.beard,
  "beard-styling": IMAGES.mensSalon,
  "classic-shave": IMAGES.shave,
  "haircut-beard-combo": IMAGES.mensSalon,
  "mens-grooming-package": IMAGES.facialMan,
  facial: IMAGES.facialWoman,
  "clean-up": IMAGES.facialMan,
  "de-tan-treatment": IMAGES.facialWoman,
  "skincare-treatment": IMAGES.facialWoman,
  threading: IMAGES.brideSmile,
  waxing: IMAGES.henna,
  "eyebrow-shaping": IMAGES.makeupArtist,
  manicure: IMAGES.manicure,
  pedicure: IMAGES.henna,
  "nail-cleaning-basic-care": IMAGES.manicure,
  "nail-art": IMAGES.manicure,
  "party-makeup": IMAGES.partyLook,
  "engagement-makeup": IMAGES.mirrorBride,
  "bridal-makeup": IMAGES.bride,
  "groom-makeup": IMAGES.groom,
  "event-hairstyling": IMAGES.bridalHairBack,
  "haircut-grooming-combo": IMAGES.mensCut,
  "hair-skin-care-package": IMAGES.hairBrushing,
  "pre-bridal-package": IMAGES.mehndi,
  "bridal-groom-package": IMAGES.couple,
  "festival-glow-package": IMAGES.festive,
};

// For services the owner adds later: pick a photo from words in the name.
const KEYWORD_IMAGES: [RegExp, string][] = [
  [/groom|sherwani/i, IMAGES.groom],
  [/bridal|bride|wedding/i, IMAGES.bride],
  [/beard/i, IMAGES.beard],
  [/shave/i, IMAGES.shave],
  [/kid|child|boy|girl/i, IMAGES.kid],
  [/facial|clean|tan|skin|glow/i, IMAGES.facialWoman],
  [/thread|brow|wax/i, IMAGES.brideSmile],
  [/pedicure|mehndi|henna/i, IMAGES.henna],
  [/manicure|nail/i, IMAGES.manicure],
  [/makeup|party|engagement/i, IMAGES.partyLook],
  [/wash|spa|treatment/i, IMAGES.wetHair],
  [/colou?r|highlight/i, IMAGES.bridalHairBack],
  [/men|cut/i, IMAGES.mensCut],
  [/hair|style/i, IMAGES.hairBrushing],
];

export function serviceImageFor(slug: string, name: string): string | undefined {
  return SERVICE_IMAGES[slug] ?? KEYWORD_IMAGES.find(([re]) => re.test(name))?.[1];
}

/** Representative image for a service category slug. */
export const CATEGORY_IMAGES: Record<string, string> = {
  "hair-services": IMAGES.bridalHair,
  "mens-grooming": IMAGES.beard,
  "skin-beauty": IMAGES.facialWoman,
  "nail-care": IMAGES.manicure,
  "makeup-occasions": IMAGES.makeupArtist,
  packages: IMAGES.bride,
};

/** Neutral VG placeholder shown only if a photo cannot be loaded at all. */
export const FALLBACK_IMAGE = "/placeholder.svg";
