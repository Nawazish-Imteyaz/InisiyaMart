# Insi House storefront (Stage A)

Static catalogue website: Next.js with `output: "export"`. Orders go through WhatsApp (see `docs/decisions/002`).

## Run locally
```bash
cd apps/storefront
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in ./out
```

## Edit content
- Products: `src/data/catalog.ts` (sample products: replace with real ones; `priceKwd: null` shows "Price on request")
- WhatsApp number, email: `src/lib/site.ts` (`TODO(owner)`)
- Colours and fonts: `src/app/globals.css` (tokens from `docs/brand/colors-fonts.md`)

## Deploy on Cloudflare Pages (free)
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose `InisiyaMart`:

| Setting | Value |
|---|---|
| Framework preset | Next.js (Static HTML Export) |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | `apps/storefront` |
| Environment variable | `NODE_VERSION` = `22` |

Every push to `main` redeploys automatically.
