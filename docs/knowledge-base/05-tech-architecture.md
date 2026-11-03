# 05 · Technical Architecture: Insi House (India)

> Prices are rough estimates from Nov 2026. Check current pricing before signing up.

## 1. Big picture

```
            CUSTOMERS across India (mostly phones, 4G)
                              │
        insihouse.com / GitHub Pages preview ── Cloudflare (DNS, CDN, SSL)
                              │
         ┌────────────────────▼──────────────────────┐
         │ STOREFRONT  apps/storefront               │
         │ Next.js static export · React · 3D hero   │
         │ (three.js / React Three Fiber, lazy)      │
         └──────┬───────────────────────┬────────────┘
   Stage A      │ WhatsApp order +      │  Stage B (when orders grow)
                │ Razorpay payment link │  ┌──────────────────────────┐
                ▼                       └─►│ Commerce backend          │
        Owner confirms on WhatsApp         │ Medusa v2 or Shopify      │
        → ships with Shiprocket            │ (headless) + Postgres     │
                                           └──┬────────┬────────┬──────┘
                                              ▼        ▼        ▼
                                         Razorpay  Shiprocket  WhatsApp API
                                        (UPI/cards  (couriers,  (order updates)
                                          /COD)     tracking)
```

## 2. Technology per layer
| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js 16 + React 19 + TypeScript**, static export | Fast, SEO-friendly, free hosting |
| Styling | Plain CSS with design tokens (`src/app/globals.css`), logical properties | Small, fast, easy to theme |
| Motion | CSS transitions + IntersectionObserver reveals + pointer tilt | Smooth without heavy libraries |
| 3D | **three.js + @react-three/fiber**, lazy-loaded, off for reduced motion | Rotating surahi + floating gift box in the hero |
| Fonts | Cormorant Garamond, Manrope, Noto Nastaliq Urdu (next/font, self-hosted) | |
| Payments | **Razorpay** (UPI, cards, net banking, wallets, payment links, COD support) | India standard, quick KYC |
| Shipping | **Shiprocket** (Delhivery, Blue Dart, Xpressbees…) | PIN-code serviceability, labels, tracking, COD remittance |
| WhatsApp | WhatsApp Business app now; Cloud API via Interakt/WATI later | Order updates |
| Commerce (Stage B) | **Medusa v2** (or Shopify headless if the family prefers an easy admin) | Cart, orders, stock, admin |
| Analytics | GA4, Meta Pixel, Microsoft Clarity | |
| Hosting | GitHub Pages (preview) → Cloudflare Pages + own domain | Free |

## 3. Services checklist
| Service | Purpose | Cost (approx.) |
|---|---|---|
| Domain (`insihouse.in` / `.com`) | Web address | ~₹500–1,500 / yr |
| Cloudflare | DNS, CDN, Pages hosting | Free |
| GitHub | Code + preview hosting | Free |
| Razorpay | Payments | ~2% per transaction (verify) |
| Shiprocket | Shipping | Per parcel, by weight & zone |
| Google Workspace / Zoho Mail | `hello@insihouse.in` | ~₹100–150 / user / month |
| WhatsApp Business | Orders & support | Free app |

## 4. Storefront code structure
```
apps/storefront/
├── src/app/                 pages: / · /shop · /product/[slug] · /story
├── src/components/          Header, Footer, ProductCard, Hero3D, Reveal, TiltCard, Logo, Icons
├── src/data/catalog.ts      products, occasions, categories (TODO(owner): real data)
├── src/lib/site.ts          WhatsApp number, email, brand strings
└── src/app/globals.css      design tokens + components
```

## 5. Engineering rules
- Money as integer paise; format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- CSS logical properties (`margin-inline`, `inset-inline-start`) so Urdu/RTL blocks work.
- Every animation respects `prefers-reduced-motion`; the 3D scene is lazy-loaded and never blocks content.
- Keep JS small: the 3D bundle loads only on the home page.
- Secrets in `.env` only.
