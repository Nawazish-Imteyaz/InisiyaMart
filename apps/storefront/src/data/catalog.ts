// Catalogue. Comes from the admin console database (downloaded at build time by next.config.ts
// into ./generated/catalog.json). If that is not available yet, the SAMPLE catalogue below is used.
import generated from "./generated/catalog.json";

export type Tone = "ink" | "rose" | "blush" | "mauve" | "plum" | "dusty";
export type Art = "pot" | "fabric" | "gift" | "frame" | "diya" | "clutch";
export type CategoryColor = "plum" | "ink" | "rani" | "marigold" | "peacock" | "lilac" | "rose";

export interface Category {
  slug: string;
  name: string;
  sub: string;
  art: Art;
  color: CategoryColor;
  image: string | null;
}

export interface Product {
  slug: string;
  name: string;
  /** Category slug */
  category: string;
  /** Category name, shown on cards */
  craft: string;
  collection: string;
  badge: string;
  summary: string;
  details: string;
  /** Price in ₹ incl. GST. null = not set yet → "Price on request". */
  priceInr: number | null;
  mrpInr: number | null;
  inStock: boolean;
  personalisable: boolean;
  occasions: string[];
  tone: Tone;
  art: Art;
  images: string[];
}

export interface Settings {
  whatsapp: string;
  email: string;
  announcement: string;
  delivery: string;
  instagram: string;
  /** Merchant UPI ID for the "Pay by UPI" button. Empty = pay link sent on WhatsApp. */
  upi_id: string;
  /** Delivery charge in ₹ as text; "" = not set (confirmed on WhatsApp). */
  shipping_fee: string;
  free_shipping_above: string;
}

interface LiveCatalog {
  source: "live";
  settings: Partial<Settings>;
  categories: Category[];
  products: Product[];
}

// ---------------- Sample catalogue (used until the database is live) ----------------
const sampleCategories: Category[] = [
  { slug: "black-pottery", name: "Black Pottery", sub: "Nizamabad craft", art: "pot", color: "ink", image: null },
  { slug: "silk-dupattas", name: "Silk & Dupattas", sub: "Mubarakpur weaves", art: "fabric", color: "rani", image: null },
  { slug: "gift-hampers", name: "Gift Hampers", sub: "Ready to gift", art: "gift", color: "marigold", image: null },
  { slug: "home-decor", name: "Home Décor", sub: "Art & calligraphy", art: "frame", color: "peacock", image: null },
  { slug: "embroidery", name: "Embroidery", sub: "Hand-embroidered", art: "clutch", color: "lilac", image: null },
];

const s = (p: Omit<Product, "craft" | "details" | "mrpInr" | "inStock" | "images" | "occasions" | "priceInr"> & { occasions?: string[] }): Product => ({
  ...p,
  craft: sampleCategories.find((c) => c.slug === p.category)?.name ?? "Handmade",
  details: "",
  priceInr: null,
  mrpInr: null,
  inStock: true,
  images: [],
  occasions: p.occasions ?? [],
});

const sampleProducts: Product[] = [
  s({ slug: "etched-black-pottery-vase", name: "Etched black pottery vase", category: "black-pottery", collection: "Nafees", badge: "Handmade", summary: "Glossy black clay with a hand-etched silver-coloured pattern, inspired by the pottery of Nizamabad, Azamgarh.", tone: "ink", art: "pot", personalisable: true }),
  s({ slug: "silk-dupatta", name: "Silk dupatta", category: "silk-dupattas", collection: "Tohfa", badge: "Handmade", summary: "A soft, elegant dupatta in the weaving tradition of Mubarakpur. A gift she will wear again and again.", tone: "dusty", art: "fabric", personalisable: false }),
  s({ slug: "festive-gift-hamper", name: "Festive gift hamper", category: "gift-hampers", collection: "Tohfa", badge: "Gift set", summary: "A curated box of handmade pieces for Diwali, Eid or Rakhi, wrapped in our signature box with your message card.", tone: "blush", art: "gift", personalisable: false }),
  s({ slug: "calligraphy-wall-frame", name: "Calligraphy wall frame", category: "home-decor", collection: "Zauq", badge: "Personalised", summary: "Hand-made calligraphy art for the home, with a name or verse of your choice.", tone: "mauve", art: "frame", personalisable: true }),
  s({ slug: "black-pottery-tea-set", name: "Black pottery tea set", category: "black-pottery", collection: "Nafees", badge: "Handmade", summary: "A decorative tea set in black clay with etched detailing, made to be displayed and admired.", tone: "ink", art: "pot", personalisable: false }),
  s({ slug: "embroidered-clutch", name: "Embroidered clutch", category: "embroidery", collection: "Tohfa", badge: "Handmade", summary: "A hand-embroidered clutch for weddings, festivals and evenings out.", tone: "rose", art: "clutch", personalisable: false }),
  s({ slug: "silk-cushion-covers", name: "Silk cushion covers", category: "silk-dupattas", collection: "Zauq", badge: "Handmade", summary: "Handwoven silk cushion covers that bring warmth and colour to any room.", tone: "dusty", art: "fabric", personalisable: false }),
  s({ slug: "pottery-diya-set", name: "Pottery diya set", category: "black-pottery", collection: "Nafees", badge: "Gift set", summary: "A set of black pottery diyas with etched patterns, beautiful for Diwali and festive evenings.", tone: "plum", art: "diya", personalisable: false }),
  s({ slug: "name-calligraphy-plate", name: "Name calligraphy plate", category: "home-decor", collection: "Khuloos", badge: "Personalised", summary: "A decorative plate with a name in English, Hindi or Urdu. A thoughtful thank-you gift.", tone: "mauve", art: "frame", personalisable: true }),
];

// ---------------- Active catalogue ----------------
const live = (generated as { source?: string }).source === "live" ? (generated as unknown as LiveCatalog) : null;

export const isSampleCatalog = !live;
export const products: Product[] = live?.products ?? sampleProducts;
export const categories: Category[] = live?.categories ?? sampleCategories;
export const settings: Settings = {
  whatsapp: "",
  email: "",
  announcement: "✦ Handmade in Azamgarh · Delivered across India · Gift-wrapped with love ✦",
  delivery: "Delivered across India",
  instagram: "",
  upi_id: "",
  shipping_fee: "",
  free_shipping_above: "",
  ...Object.fromEntries(Object.entries(live?.settings ?? {}).filter(([, v]) => typeof v === "string" && v !== "")),
};

/** Tile backgrounds for each category colour chosen in the admin. */
export const categoryGradients: Record<CategoryColor, string> = {
  ink: "linear-gradient(150deg, #4a3640 0%, #2b1b22 70%)",
  rani: "linear-gradient(150deg, #f07aa2 0%, #c22f63 75%)",
  marigold: "linear-gradient(150deg, #ffc857 0%, #e88a1a 80%)",
  peacock: "linear-gradient(150deg, #2aa3a8 0%, #0c5d62 80%)",
  plum: "linear-gradient(150deg, #a0436d 0%, #4a1530 80%)",
  lilac: "linear-gradient(150deg, #cdb6ee 0%, #8a63c7 80%)",
  rose: "linear-gradient(150deg, #f3b3c2 0%, #c9677f 80%)",
};

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

export function formatInr(n: number): string {
  return inr.format(n);
}

export function formatPrice(p: Product): string {
  return p.priceInr === null ? "Price on request" : inr.format(p.priceInr);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function shopLink(categorySlug?: string): string {
  return categorySlug ? `/shop/?c=${encodeURIComponent(categorySlug)}` : "/shop/";
}
