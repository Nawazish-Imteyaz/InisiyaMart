import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/site";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <a className="wa-float" href={whatsappLink("Hello Insi House!")} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
        <ChatIcon />
      </a>
    </>
  );
}
