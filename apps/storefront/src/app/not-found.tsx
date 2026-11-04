import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <div className="container section" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <h1 className="display" style={{ fontSize: 48 }}>This page wandered off</h1>
          <p className="muted">Let&apos;s find you a beautiful gift instead.</p>
          <Link href="/shop/" className="btn">Shop gifts</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
