// Site-wide settings. Fill the TODO(owner) values when the owner provides them.
export const site = {
  name: "Insi House",
  urdu: "انسی ہاؤس",
  tagline: "Handmade gifts from Azamgarh",
  taglineUrdu: "اعظم گڑھ کے ہنر کا تحفہ",
  delivery: "Delivered across India",
  // TODO(owner): WhatsApp business number with country code, no "+", e.g. "9198XXXXXXXX".
  whatsapp: "",
  // TODO(owner): business email.
  email: "",
};

/** Opens WhatsApp with a pre-filled message. Without a number set, WhatsApp lets the user pick a chat. */
export function whatsappLink(message: string): string {
  const base = site.whatsapp ? `https://wa.me/${site.whatsapp}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
