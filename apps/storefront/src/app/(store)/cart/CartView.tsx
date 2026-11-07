"use client";

import Link from "next/link";
import { formatInr, productLink, type Product, type Settings } from "@/data/catalog";
import { cart, MAX_QTY, useCart } from "@/lib/cart";
import { shippingFor, useLiveCatalog } from "@/lib/live";
import { ProductArt } from "@/components/ProductArt";

export function CartView(props: { products: Product[]; settings: Settings }) {
  const { lines, ready } = useCart();
  const { products, settings } = useLiveCatalog(props);

  if (!ready) return <div className="cart-empty"><span className="spinner" aria-label="Loading" /></div>;

  const rows = lines.map((l) => ({ line: l, p: products.find((x) => x.slug === l.slug) }));
  const gone = rows.filter((r) => !r.p || r.p.priceInr === null);
  const ok = rows.filter((r): r is { line: typeof r.line; p: Product } => !!r.p && r.p.priceInr !== null);
  const subtotal = ok.reduce((s, r) => s + r.line.qty * (r.p.priceInr ?? 0), 0);
  const shipping = shippingFor(settings, subtotal);
  const problems = ok.filter((r) => !r.p.inStock);

  if (lines.length === 0) {
    return (
      <div className="cart-empty">
        <h1 className="display">Your cart is empty</h1>
        <p className="muted">Find a handmade gift she&apos;ll treasure.</p>
        <Link href="/shop/" className="btn btn-glow">Shop gifts</Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <section>
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 48px)", marginBlockEnd: 20 }}>Your cart</h1>
        <ul className="cart-list">
          {ok.map(({ line, p }) => (
            <li key={p.slug} className="cart-line">
              <Link href={productLink(p.slug)} className={`cart-thumb tone-${p.tone}`} aria-label={p.name}>
                {p.images[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.images[0]} alt="" />
                  : <ProductArt art={p.art} size={56} light={["ink", "plum", "dusty"].includes(p.tone)} />}
              </Link>
              <div className="cart-info">
                <Link href={productLink(p.slug)} className="cart-name">{p.name}</Link>
                <span className="muted">{formatInr(p.priceInr ?? 0)} each</span>
                {!p.inStock && <span className="stock-out" style={{ alignSelf: "flex-start" }}>Out of stock: please remove</span>}
                <div className="cart-actions">
                  <div className="qty small" role="group" aria-label={`Quantity of ${p.name}`}>
                    <button type="button" aria-label="One less" onClick={() => cart.set(p.slug, line.qty - 1)}>−</button>
                    <span>{line.qty}</span>
                    <button type="button" aria-label="One more" disabled={line.qty >= MAX_QTY} onClick={() => cart.set(p.slug, line.qty + 1)}>+</button>
                  </div>
                  <button type="button" className="link-btn" onClick={() => cart.set(p.slug, 0)}>Remove</button>
                </div>
              </div>
              <b className="cart-price">{formatInr(line.qty * (p.priceInr ?? 0))}</b>
            </li>
          ))}
        </ul>
        {gone.length > 0 && (
          <div className="infobox" style={{ marginBlockStart: 16 }}>
            <b>Some items can&apos;t be bought online</b>
            {gone.map(({ line, p }) => (
              <span key={line.slug} className="muted">
                {p ? `${p.name} has no fixed price. Ask us on WhatsApp.` : "A gift in your cart is no longer available."}{" "}
                <button type="button" className="link-btn" onClick={() => cart.set(line.slug, 0)}>Remove</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <aside className="cart-summary">
        <h2>Order summary</h2>
        <div className="sum-row"><span>Subtotal</span><b>{formatInr(subtotal)}</b></div>
        <div className="sum-row"><span>Delivery</span><b>{shipping === null ? "Confirmed on WhatsApp" : shipping === 0 ? "Free" : formatInr(shipping)}</b></div>
        {shipping !== null && shipping > 0 && settings.free_shipping_above !== "" && (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Free delivery on orders above {formatInr(Number(settings.free_shipping_above))}.</p>
        )}
        <div className="sum-row total"><span>Total</span><b>{formatInr(subtotal + (shipping ?? 0))}</b></div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Prices include GST. Gift-wrapped by hand.</p>
        {problems.length > 0 || ok.length === 0 ? (
          <button className="btn btn-glow" disabled>Remove out-of-stock items to continue</button>
        ) : (
          <Link href="/checkout/" className="btn btn-glow">Checkout</Link>
        )}
        <Link href="/shop/" className="link-more" style={{ textAlign: "center" }}>← Continue shopping</Link>
      </aside>
    </div>
  );
}
