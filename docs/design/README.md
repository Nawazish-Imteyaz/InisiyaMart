# Designs

| Design | Live view (private, owner login) | Source files |
|---|---|---|
| Brand concepts (3 directions + recommended final) | https://claude.ai/artifact/84epr9T8pLyHt1fghBX6s5 | `brand-concepts/` |
| Website UI (9 pages) | https://claude.ai/artifact/WYfHsN7DjFhUVjNexuEQWY | `website/` |

## Website pages
| # | Page | File | Notes |
|---|---|---|---|
| 1 | Home (desktop) | `website/Main.dc.html` | Hero, occasions, collections, loved gifts, story, reminders |
| 2 | Shop / category | `website/Category.dc.html` | Quick filter chips, side filters, product grid |
| 3 | Product | `website/Product.dc.html` | Arch gallery, size, name engraving, gift wrap, craft story |
| 4 | Gift bag (cart) | `website/Cart.dc.html` | Wrap choice, promo code, summary |
| 5 | Checkout | `website/Checkout.dc.html` | Gift vs self, Kuwait address fields, message card, KNET / Apple Pay |
| 6 | Our story & makers | `website/Story.dc.html` | Family story, Nizamabad pottery, Mubarakpur silk |
| 7 | Home on phone | `website/HomeMobile.dc.html` | Mobile-first, bottom tab bar, WhatsApp button |
| 8 | Arabic home on phone | `website/HomeArabic.dc.html` | Full RTL. **Arabic copy needs native Gulf review** |
| 9 | Order tracking on phone | `website/Tracking.dc.html` | Step timeline, message card, WhatsApp updates |

All `[brackets]` are placeholders for real owner data (prices, photos, names, delivery days).
The `.dc.html` files are design mock-ups, not production code. The real site will be built in Next.js
following these layouts (see `docs/knowledge-base/05-tech-architecture.md`).
