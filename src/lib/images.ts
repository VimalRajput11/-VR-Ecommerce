// Licensed Unsplash photography used for decorative/brand imagery only. These are not
// presented as the salon's own work; the Gallery page shows owner-uploaded images.

const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=${w}`;

export const IMAGES = {
  heroInterior: u("1560066984-138dadb4c035", 2000),
  salonBright: u("1633681926022-84c23e8cb2d6"),
  salonDark: u("1600948836101-f9ffda59d250"),
  salonWhite: u("1521590832167-7bcbfaa6381f"),
  barberShop: u("1585747860715-2ba37e788b70"),
  blowDry: u("1562322140-8baeececf3df"),
  blowDry2: u("1580618672591-eb180b1a973f"),
  hairWash: u("1595476108010-b4d1f102b1b1"),
  hairWash2: u("1634449571010-02389ed0f9b0"),
  mensCut: u("1622286342621-4bd786c2447c"),
  mensBlowDry: u("1605497788044-5a32c7078486"),
  beard: u("1599351431202-1e0f0137899a"),
  shave: u("1503951914875-452162b0f3f1"),
  facial: u("1570172619644-dfd03ed5d881"),
  facialMask: u("1616394584738-fc6e612e71b9"),
  makeup: u("1487412947147-5cebf100ffc2"),
  makeupKit: u("1512496015851-a90fb38ba796"),
  manicure: u("1457972729786-0411a3b2b626"),
  pedicure: u("1519415510236-718bdfcd89c8"),
  nails: u("1604654894610-df63bc536371"),
  hairTools: u("1527799820374-dcf8d9d4a388"),
  stylists: u("1559599101-f09722fb4948"),
  curls: u("1519699047748-de8e457a634e"),
} as const;

/** Representative image for a service category slug. */
export const CATEGORY_IMAGES: Record<string, string> = {
  "hair-services": IMAGES.blowDry,
  "mens-grooming": IMAGES.beard,
  "skin-beauty": IMAGES.facial,
  "nail-care": IMAGES.manicure,
  "makeup-occasions": IMAGES.makeup,
  packages: IMAGES.salonBright,
};

export const FALLBACK_IMAGE = IMAGES.salonWhite;
