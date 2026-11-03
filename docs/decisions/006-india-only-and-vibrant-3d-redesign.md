# 006 · India only + vibrant 3D redesign

- **Date:** 2026-11-03
- **Status:** accepted (owner instruction)
- **Context:** The owner will deliver **all over India**, not to the GCC. The owner also asked for a more attractive,
  colourful, smoother site with 3D elements that looks better than Bleems.
- **Decision:**
  - Market = **India only**. GCC research is moved to `docs/knowledge-base/archive/`. No GCC mentions on the site.
  - Currency ₹ INR (incl. GST), UPI-first payments (Razorpay), Shiprocket for shipping, PIN-code delivery checks.
  - Languages: English now, Hindi later, Urdu in branding.
  - Design: Rose Plum stays the base (decision 005), with **festive Indian accents** (marigold, rani pink, peacock, mango, lilac).
  - Motion: scroll reveals, hover lifts, 3D tilt cards, marquee. **3D hero**: a rotating black-pottery surahi and a floating gift box
    (three.js / React Three Fiber, lazy-loaded, disabled for reduced motion).
  - Bleems review (2026-11-03): Bleems has mega-menus, a delivery-area modal, "What are you looking for" tiles, occasion tiles,
    product rails and app badges, but no hero, motion or 3D. We keep its useful patterns and add those.
- **Consequences:** The knowledge base and storefront copy were rewritten for India. The 3D library adds ~200 KB, lazy-loaded after the page shows.
