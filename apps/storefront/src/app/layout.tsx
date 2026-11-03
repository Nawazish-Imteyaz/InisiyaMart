import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Noto_Nastaliq_Urdu } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatIcon } from "@/components/Icons";
import { site, whatsappLink } from "@/lib/site";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-urdu", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: "Handmade gifts from Azamgarh: black pottery, Mubarakpur silk and hand-crafted décor, delivered across the GCC.",
};

export const viewport: Viewport = { themeColor: "#6B2142" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${urdu.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <a className="wa-float" href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
          <ChatIcon />
        </a>
      </body>
    </html>
  );
}
