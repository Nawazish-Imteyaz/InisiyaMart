// Site-wide settings. WhatsApp, email, announcement and delivery line are edited in the admin console
// (Settings) and arrive with the catalogue at build time.
import { settings } from "@/data/catalog";

export const site = {
  name: "Insi House",
  urdu: "انسی ہاؤس",
  tagline: "Handmade gifts from Azamgarh",
  taglineUrdu: "اعظم گڑھ کے ہنر کا تحفہ",
  delivery: settings.delivery,
  announcement: settings.announcement,
  /** WhatsApp number with country code, no "+", e.g. "919876543210". Empty → WhatsApp lets the user pick a chat. */
  whatsapp: settings.whatsapp,
  email: settings.email,
  instagram: settings.instagram,
};

/** Opens WhatsApp with a pre-filled message. */
export function whatsappLink(message: string): string {
  const base = site.whatsapp ? `https://wa.me/${site.whatsapp}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
