// Decorative/brand imagery featuring Indian clients and stylists. Photos are from Unsplash
// (free under the Unsplash License) and are stored in /public/images so the site doesn't depend
// on Unsplash being fast or available. They are not presented as the salon's own work; the
// Gallery page shows owner-uploaded images. The Unsplash photo ID is noted for each.

const local = (name: string) => `/images/${name}.jpg`;

export const IMAGES = {
  // Hair
  bridalHair: local("bridalHair"), // stylist finishing a bridal updo — unsplash 1672788725446-c303ec2b318e
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
} as const;

/** Representative image for a service category slug. */
export const CATEGORY_IMAGES: Record<string, string> = {
  "hair-services": IMAGES.bridalHair,
  "mens-grooming": IMAGES.beard,
  "skin-beauty": IMAGES.facialWoman,
  "nail-care": IMAGES.manicure,
  "makeup-occasions": IMAGES.makeupArtist,
  packages: IMAGES.bride,
};

export const FALLBACK_IMAGE = IMAGES.hairBrushing;
