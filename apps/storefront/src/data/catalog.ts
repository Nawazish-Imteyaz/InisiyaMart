// Catalogue. These are SAMPLE products based on the designs.
// TODO(owner): replace with real products, ₹ prices and photos (see docs/knowledge-base/08-brand-intake.md).

export type Tone = "ink" | "rose" | "blush" | "mauve" | "plum" | "dusty";
export type Art = "pot" | "fabric" | "gift" | "frame" | "diya" | "clutch";
export type Craft = "Black pottery" | "Silk & dupattas" | "Embroidery" | "Calligraphy art" | "Gift hampers";

export interface Product {
  slug: string;
  name: string;
  craft: Craft;
  collection: string;
  badge: "Handmade" | "Gift set" | "Personalised";
  summary: string;
  /** Price in ₹ incl. GST. null = not set yet → "Price on request". */
  priceInr: number | null;
  tone: Tone;
  art: Art;
  personalisable: boolean;
}

export const products: Product[] = [
  { slug: "etched-black-pottery-vase", name: "Etched black pottery vase", craft: "Black pottery", collection: "Nafees", badge: "Handmade", summary: "Glossy black clay with a hand-etched silver-coloured pattern, inspired by the pottery of Nizamabad, Azamgarh.", priceInr: null, tone: "ink", art: "pot", personalisable: true },
  { slug: "silk-dupatta", name: "Silk dupatta", craft: "Silk & dupattas", collection: "Tohfa", badge: "Handmade", summary: "A soft, elegant dupatta in the weaving tradition of Mubarakpur. A gift she will wear again and again.", priceInr: null, tone: "dusty", art: "fabric", personalisable: false },
  { slug: "festive-gift-hamper", name: "Festive gift hamper", craft: "Gift hampers", collection: "Tohfa", badge: "Gift set", summary: "A curated box of handmade pieces for Diwali, Eid or Rakhi, wrapped in our signature box with your message card.", priceInr: null, tone: "blush", art: "gift", personalisable: false },
  { slug: "calligraphy-wall-frame", name: "Calligraphy wall frame", craft: "Calligraphy art", collection: "Zauq", badge: "Personalised", summary: "Hand-made calligraphy art for the home, with a name or verse of your choice.", priceInr: null, tone: "mauve", art: "frame", personalisable: true },
  { slug: "black-pottery-tea-set", name: "Black pottery tea set", craft: "Black pottery", collection: "Nafees", badge: "Handmade", summary: "A decorative tea set in black clay with etched detailing, made to be displayed and admired.", priceInr: null, tone: "ink", art: "pot", personalisable: false },
  { slug: "embroidered-clutch", name: "Embroidered clutch", craft: "Embroidery", collection: "Tohfa", badge: "Handmade", summary: "A hand-embroidered clutch for weddings, festivals and evenings out.", priceInr: null, tone: "rose", art: "clutch", personalisable: false },
  { slug: "silk-cushion-covers", name: "Silk cushion covers", craft: "Silk & dupattas", collection: "Zauq", badge: "Handmade", summary: "Handwoven silk cushion covers that bring warmth and colour to any room.", priceInr: null, tone: "dusty", art: "fabric", personalisable: false },
  { slug: "pottery-diya-set", name: "Pottery diya set", craft: "Black pottery", collection: "Nafees", badge: "Gift set", summary: "A set of black pottery diyas with etched patterns, beautiful for Diwali and festive evenings.", priceInr: null, tone: "plum", art: "diya", personalisable: false },
  { slug: "name-calligraphy-plate", name: "Name calligraphy plate", craft: "Calligraphy art", collection: "Khuloos", badge: "Personalised", summary: "A decorative plate with a name in English, Hindi or Urdu. A thoughtful thank-you gift.", priceInr: null, tone: "mauve", art: "frame", personalisable: true },
];

export const crafts: Craft[] = ["Black pottery", "Silk & dupattas", "Embroidery", "Calligraphy art", "Gift hampers"];

/** "What are you looking for?" tiles */
export const categories: { name: string; sub: string; art: Art; bg: string }[] = [
  { name: "Black Pottery", sub: "Nizamabad craft", art: "pot", bg: "linear-gradient(150deg, #4a3640 0%, #2b1b22 70%)" },
  { name: "Silk & Dupattas", sub: "Mubarakpur weaves", art: "fabric", bg: "linear-gradient(150deg, #f07aa2 0%, #c22f63 75%)" },
  { name: "Gift Hampers", sub: "Ready to gift", art: "gift", bg: "linear-gradient(150deg, #ffc857 0%, #e88a1a 80%)" },
  { name: "Home Décor", sub: "Art & calligraphy", art: "frame", bg: "linear-gradient(150deg, #2aa3a8 0%, #0c5d62 80%)" },
];

export const collections = [
  { name: "Tohfa", urdu: "تحفہ", desc: "Gift sets & hampers", cls: "c-plum" },
  { name: "Nafees", urdu: "نفیس", desc: "Our luxury line", cls: "c-ink" },
  { name: "Zauq", urdu: "ذوق", desc: "Home décor with taste", cls: "c-marigold" },
  { name: "Khuloos", urdu: "خلوص", desc: "Thank-you & corporate gifts", cls: "c-lilac" },
];

export const occasions: { name: string; urdu?: string; bg: string }[] = [
  { name: "Raksha Bandhan", bg: "linear-gradient(160deg, #ff9ab8, #e0457b)" },
  { name: "Diwali", bg: "linear-gradient(160deg, #ffd27a, #f08a1c)" },
  { name: "Eid", urdu: "عید", bg: "linear-gradient(160deg, #3fb5a5, #127c82)" },
  { name: "Wedding & Nikah", bg: "linear-gradient(160deg, #d07a9a, #6b2142)" },
  { name: "Birthday", bg: "linear-gradient(160deg, #d9c6f5, #9b7ad1)" },
  { name: "Anniversary", bg: "linear-gradient(160deg, #ff8f8f, #c93a4f)" },
  { name: "Mother's Day", bg: "linear-gradient(160deg, #ffc8d6, #d4899b)" },
  { name: "Thank You", bg: "linear-gradient(160deg, #ffe08a, #e0a526)" },
];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatPrice(p: Product): string {
  return p.priceInr === null ? "Price on request" : inr.format(p.priceInr);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
