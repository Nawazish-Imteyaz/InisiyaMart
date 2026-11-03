# Project: Insi House (انسی ہاؤس) · Azamgarh Crafts → GCC Gifting Marketplace

**Brand:** Insi House · Urdu wordmark: انسی ہاؤس · domain/handle: `insihouse`
(see `docs/decisions/001-brand-name.md`, `003-brand-identity.md`, and `docs/brand/colors-fonts.md` for logo, colours and fonts).
Azamgarh's language is **Urdu**: use Urdu in the brand and storytelling, and Arabic for the GCC website UI.

> This file loads automatically in every Claude Code session in this folder.
> It is the **entry point**. The detailed knowledge lives in `docs/knowledge-base/`.

## What we are building
An online gifting and craft marketplace, **inspired by the style and model of Bleems (bleems.com/kw)**.
It sells **handmade creative products rooted in Azamgarh (Uttar Pradesh, India) culture**, made by our
family business, to customers in **all six GCC countries**: Kuwait, Saudi Arabia, UAE, Qatar, Bahrain and Oman.

- Bleems = the **reference for UX, structure and business model** (occasions, gifting, multi-country, Arabic/English).
- **We never copy** Bleems' (or any site's) name, logo, text, photos or exact design. We build our **own brand**.
- Brand name is decided: **Insi House**. Logo, colours and products come from the owner. See `docs/knowledge-base/08-brand-intake.md`.

## Knowledge base (read the relevant file before working on that area)
| File | Use it when working on |
|---|---|
| `docs/knowledge-base/00-project-overview.md` | Vision, audience, business model, open decisions |
| `docs/knowledge-base/01-reference-websites.md` | Features to borrow from Bleems, Floward, Etsy, iTokri, etc. |
| `docs/knowledge-base/02-feature-spec.md` | Every page and feature: customer, seller, admin |
| `docs/knowledge-base/03-gcc-market.md` | Countries, currencies, VAT, payments, Arabic/RTL, occasions |
| `docs/knowledge-base/04-azamgarh-crafts.md` | Product knowledge, categories, storytelling |
| `docs/knowledge-base/05-tech-architecture.md` | Stack, data model, folder layout, integrations |
| `docs/knowledge-base/06-shipping-and-legal.md` | India → GCC shipping, customs, export registration, policies |
| `docs/knowledge-base/07-roadmap.md` | Phases, milestones, what to build next |
| `docs/knowledge-base/08-brand-intake.md` | What the owner must provide (name, logo, products…) |
| `docs/knowledge-base/09-glossary.md` | Terms used across the docs |
| `docs/brand/` | Logo files, colours, fonts, photos supplied by the owner |
| `docs/decisions/` | Decision log (one file per decision) |

## Working rules for Claude
1. **Original brand only.** Use Bleems and the other reference sites for patterns, never for assets or text.
2. **Bilingual from day one.** Every UI string goes in English **and** Arabic files. Layouts must work in RTL.
3. **Multi-country from day one.** Prices, currency, VAT, delivery rules and payment methods depend on the selected country.
4. **Mobile first.** Most GCC shoppers buy on their phones. Design for 375px first.
5. **Culture-respectful.** Product copy should be suitable for GCC audiences. No alcohol or pork imagery, modest model photography, and seasonal campaigns around Ramadan, Eid and National Days.
6. **Craft storytelling.** Every product links to its craft story, region and maker (see `04-azamgarh-crafts.md`).
7. **Do not invent business facts.** If a price, policy, legal rule or brand detail is unknown, write `TODO(owner)` and add it to the "Open questions" list in `00-project-overview.md`.
8. **Verify regulations.** Tax, customs and payment rules in `03` and `06` were written in Nov 2026 and can change. Check them before launch.
9. **Log decisions.** Any significant choice (stack, payment gateway, shipping partner) goes in `docs/decisions/NNN-title.md`.

## Specialist agent
`.claude/agents/gcc-marketplace-expert.md` is a project subagent with all of this knowledge.
Ask Claude to "use the gcc-marketplace-expert agent" for planning, feature design, product listings or reviews.
