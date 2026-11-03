# Project: Insi House (انسی ہاؤس) · Handmade Azamgarh gifts, delivered across India

**Brand:** Insi House · Urdu wordmark: انسی ہاؤس · domain/handle: `insihouse`
(see `docs/decisions/001-brand-name.md`, `003-brand-identity.md`, `005-final-design-rose-plum.md`, and `docs/brand/colors-fonts.md`).

> This file loads automatically in every Claude Code session in this folder.
> It is the **entry point**. The detailed knowledge lives in `docs/knowledge-base/`.

## What we are building
An online gifting and craft store, **inspired by the gifting UX of Bleems (bleems.com)** but more colourful, smoother and with 3D touches.
It sells **handmade creative products rooted in Azamgarh (Uttar Pradesh) culture**, made by our family business,
to customers **all over India** (decision 006). We do **not** deliver to the GCC; that research is archived in `docs/knowledge-base/archive/`.

- Bleems is the **reference for gifting UX and structure** (occasions, product rails, gift messages). We **never copy** its name, logo, text, photos or exact design.
- **Main audience:** girls, women and students across India, gifting for sisters, mothers and friends (decision 004).
- **Final design:** Rose Plum + festive Indian accents (decision 005, updated by 006).

## Knowledge base (read the relevant file before working on that area)
| File | Use it when working on |
|---|---|
| `docs/knowledge-base/00-project-overview.md` | Vision, audience, business model, open decisions |
| `docs/knowledge-base/01-reference-websites.md` | Features to borrow from Bleems, FNP, IGP, Etsy, iTokri, Jaypore… |
| `docs/knowledge-base/02-feature-spec.md` | Every page and feature: customer, seller, admin |
| `docs/knowledge-base/03-india-market.md` | INR, GST, UPI/Razorpay, languages, festival calendar, marketing |
| `docs/knowledge-base/04-azamgarh-crafts.md` | Product knowledge, categories, storytelling |
| `docs/knowledge-base/05-tech-architecture.md` | Stack, data model, folder layout, integrations |
| `docs/knowledge-base/06-india-shipping-and-legal.md` | Couriers, pincodes, COD, GST, e-commerce rules, policies |
| `docs/knowledge-base/07-roadmap.md` | Phases, milestones, what to build next |
| `docs/knowledge-base/08-brand-intake.md` | What the owner must provide (logo, products…) |
| `docs/knowledge-base/09-glossary.md` | Terms used across the docs |
| `docs/brand/` | Logo, colours, fonts, photos |
| `docs/design/` | Page designs (mock-ups) |
| `docs/decisions/` | Decision log (one file per decision) |
| `apps/storefront/` | The live website code (Next.js static export) |

## Working rules for Claude
1. **Original brand only.** Use reference sites for patterns, never for assets or text.
2. **India only.** Prices in ₹ INR (inclusive of GST), Indian addresses with 6-digit PIN codes, UPI-first payments. Never mention GCC delivery.
3. **Languages:** English first; Hindi and Urdu later. Urdu (Nastaliq) is used in the brand and storytelling.
4. **Mobile first.** Most Indian shoppers buy on phones. Design for 375px first; keep pages fast on 4G.
5. **Colourful but premium.** Rose Plum base with festive accents (marigold, rani pink, peacock). Smooth motion, respect `prefers-reduced-motion`.
6. **Craft storytelling.** Every product links to its craft story, region and maker (see `04-azamgarh-crafts.md`).
7. **Do not invent business facts.** Unknown price, policy, legal rule or brand detail → `TODO(owner)` + add to "Open questions" in `00-project-overview.md`.
8. **Verify regulations.** GST, e-commerce and courier rules in `03` and `06` were written in Nov 2026 and can change.
9. **Log decisions** in `docs/decisions/NNN-title.md`.

## Specialist agent
`.claude/agents/insi-house-expert.md` is a project subagent with all of this knowledge.
Ask Claude to "use the insi-house-expert agent" for planning, feature design, product listings or reviews.

## Build notes (this PC)
`npm run …` fails in the Bash tool (no cmd.exe). Build with
`cd apps/storefront && node node_modules/next/dist/bin/next build`.
Live preview: https://nawazish-imteyaz.github.io/InisiyaMart/ (auto-deploys from `main`).
