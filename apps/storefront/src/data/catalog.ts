// Stage A catalogue. These are SAMPLE products based on the designs.
// TODO(owner): replace with real products, prices and photos (see docs/knowledge-base/08-brand-intake.md).

export type Tone = "ink" | "rose" | "blush" | "mauve" | "plum" | "dusty";

export type Craft = "Black pottery" | "Silk & dupattas" | "Embroidery" | "Calligraphy art" | "Gift sets";

export interface Product {
  slug: string;
  name: string;
  craft: Craft;
  collection: string;
  badge: "Handmade" | "Gift set" | "Personalised";
  summary: string;
  /** Price in KWD. null = not set yet → "Price on request". */
  priceKwd: number | null;
  tone: Tone;
  personalisable: boolean;
}

export const products: Product[] = [
  {
    slug: "etched-black-pottery-vase",
    name: "Etched black pottery vase",
    craft: "Black pottery",
    collection: "Nafees",
    badge: "Handmade",
    summary: "Glossy black clay with a hand-etched silver-coloured pattern, inspired by the pottery of Nizamabad, Azamgarh.",
    priceKwd: null,
    tone: "ink",
    personalisable: true,
  },
  {
    slug: "silk-dupatta",
    name: "Silk dupatta",
    craft: "Silk & dupattas",
    collection: "Tohfa",
    badge: "Handmade",
    summary: "A soft, elegant dupatta in the weaving tradition of Mubarakpur. A gift she will wear again and again.",
    priceKwd: null,
    tone: "rose",
    personalisable: false,
  },
  {
    slug: "eid-gift-hamper",
    name: "Eid gift hamper",
    craft: "Gift sets",
    collection: "Tohfa",
    badge: "Gift set",
    summary: "A curated box of handmade pieces, wrapped in our signature plum box with your message card.",
    priceKwd: null,
    tone: "blush",
    personalisable: false,
  },
  {
    slug: "calligraphy-wall-frame",
    name: "Calligraphy wall frame",
    craft: "Calligraphy art",
    collection: "Zauq",
    badge: "Personalised",
    summary: "Hand-made calligraphy art for the home, with a name or verse of your choice.",
    priceKwd: null,
    tone: "mauve",
    personalisable: true,
  },
  {
    slug: "black-pottery-tea-set",
    name: "Black pottery tea set",
    craft: "Black pottery",
    collection: "Nafees",
    badge: "Handmade",
    summary: "A decorative tea set in black clay with etched detailing, made to be displayed and admired.",
    priceKwd: null,
    tone: "ink",
    personalisable: false,
  },
  {
    slug: "embroidered-clutch",
    name: "Embroidered clutch",
    craft: "Embroidery",
    collection: "Tohfa",
    badge: "Handmade",
    summary: "A hand-embroidered clutch for weddings, Eid and evenings out.",
    priceKwd: null,
    tone: "dusty",
    personalisable: false,
  },
  {
    slug: "silk-cushion-covers",
    name: "Silk cushion covers",
    craft: "Silk & dupattas",
    collection: "Zauq",
    badge: "Handmade",
    summary: "Handwoven silk cushion covers that bring warmth and colour to any room.",
    priceKwd: null,
    tone: "rose",
    personalisable: false,
  },
  {
    slug: "pottery-diya-set",
    name: "Pottery diya set",
    craft: "Black pottery",
    collection: "Nafees",
    badge: "Gift set",
    summary: "A set of black pottery diyas with etched patterns, beautiful for festive evenings.",
    priceKwd: null,
    tone: "plum",
    personalisable: false,
  },
  {
    slug: "name-calligraphy-plate",
    name: "Name calligraphy plate",
    craft: "Calligraphy art",
    collection: "Khuloos",
    badge: "Personalised",
    summary: "A decorative plate with a name in English, Urdu or Arabic. A thoughtful thank-you gift.",
    priceKwd: null,
    tone: "mauve",
    personalisable: true,
  },
];

export const crafts: Craft[] = ["Black pottery", "Silk & dupattas", "Embroidery", "Calligraphy art", "Gift sets"];

export const collections = [
  { name: "Tohfa", urdu: "تحفہ", desc: "Gift sets & hampers", tone: "plum" as Tone },
  { name: "Nafees", urdu: "نفیس", desc: "Our luxury line", tone: "ink" as Tone },
  { name: "Zauq", urdu: "ذوق", desc: "Home décor with taste", tone: "rose" as Tone },
  { name: "Khuloos", urdu: "خلوص", desc: "Thank-you & corporate gifts", tone: "mauve" as Tone },
];

export const occasions: { name: string; tone: Tone }[] = [
  { name: "Birthday", tone: "rose" },
  { name: "Eid", tone: "plum" },
  { name: "Wedding & Nikah", tone: "mauve" },
  { name: "Mother's Day", tone: "dusty" },
  { name: "Graduation", tone: "blush" },
  { name: "New Baby", tone: "rose" },
  { name: "Thank You", tone: "ink" },
  { name: "Corporate", tone: "mauve" },
];

export function formatPrice(p: Product): string {
  // KWD uses 3 decimals.
  return p.priceKwd === null ? "Price on request" : `${p.priceKwd.toFixed(3)} KWD`;
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
