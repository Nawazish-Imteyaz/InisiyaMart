# 01 · Reference Websites: What to Learn From Each

> Use these for **patterns and ideas only**. Never copy names, logos, photos, copy or distinctive design.
> Feature notes were written from general knowledge in Nov 2026. Re-check the live sites when designing a specific screen.

## Primary reference: Bleems (bleems.com/kw)
Kuwait-founded online gifting marketplace serving GCC countries.

**Patterns worth adopting**
| Area | Pattern | Our version |
|---|---|---|
| Country selector | Country in URL (`/kw`, `/sa`, `/ae`…) drives currency, delivery and catalogue | Same URL scheme: `/{country}/{lang}/…` |
| Language | English ⇄ Arabic toggle, full RTL | Same, with Arabic as an equal first-class language |
| Browse by occasion | Birthday, Anniversary, Get Well, New Baby, Eid, Ramadan, Mother's Day, Graduation… | Same occasions plus Wedding / Nikah, Housewarming and Corporate |
| Browse by category | Flowers, cakes, chocolates, plants, perfumes, balloons… | Our craft categories (see `04`) plus gift add-ons |
| Multi-vendor | Many shops, each with a shop page | "Maker" pages (family first, artisans later) |
| Delivery date / slot | Pick date and time slot at checkout | Pick **estimated delivery date**; time slots only for GCC hub stock |
| Gift message | Free card message, sender/recipient details, "surprise" option | Same, plus optional handwritten-style card |
| Recipient address | Send to someone else's address, often by phone and area | Recipient name, phone and area-based address (GCC addresses use area/block/street) |
| Add-ons / upsell | "Add a cake / balloon / chocolate" at the cart | "Complete the gift": wrapping, card, attar, sweets |
| Mobile app | Native app with push offers | Start as a PWA; native app in a later phase |
| Promotions | Banners per occasion, promo codes | Same, driven by the GCC calendar (`03`) |

## Similar GCC gifting sites
| Site | What to learn |
|---|---|
| **Floward** (floward.com) | Very clean premium product pages, occasion reminders ("never forget a date"), corporate gifting portal, subscriptions |
| **Noon** / **Amazon.ae / .sa** | Customer trust signals: ratings, delivery estimate on product card, cash-on-delivery norms, Arabic SEO |
| **Ounass** / **Namshi** | Premium bilingual fashion UX, RTL done well, editorial storytelling |

## Handmade / Indian craft sites
| Site | What to learn |
|---|---|
| **Etsy** | Maker profiles, "handmade" trust, personalisation fields per product, reviews with photos |
| **iTokri** (itokri.com) | Indian crafts with region-based browsing and craft stories |
| **Jaypore**, **Okhai**, **Gaatha** | Premium photography of Indian crafts, artisan storytelling, craft "journal" blog |
| **Amazon Karigar / Handmade** | Cross-border handmade listings, compliance-friendly product data |

## Feature checklist distilled from all references
- [ ] Country + language selector (persisted)
- [ ] Mega-menu: Occasions / Categories / Makers / Corporate
- [ ] Hero banners per campaign (Ramadan, Eid, National Day)
- [ ] Product card: image, name, price in local currency, delivery estimate, "handmade" badge
- [ ] Product page: gallery + zoom, video, craft story, maker, materials, size, care, personalisation fields, delivery estimator, reviews
- [ ] Wishlist, recently viewed
- [ ] Cart with gift add-ons and gift wrap
- [ ] Checkout: sender, recipient, gift message, delivery date, payment
- [ ] Order tracking page plus WhatsApp / SMS / email updates
- [ ] Occasion reminders
- [ ] Corporate gifting enquiry form plus bulk quotes
- [ ] Reviews with photos
- [ ] Blog / "Craft Journal"
- [ ] WhatsApp chat button (essential in GCC and India)
