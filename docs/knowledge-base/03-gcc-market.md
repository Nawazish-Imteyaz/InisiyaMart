# 03 · GCC Market Knowledge

> ⚠️ Tax, customs and payment facts change. Everything here was written in Nov 2026. **Verify before launch** with an accountant or customs broker.

## Countries at a glance
| Country | Code | Currency | Decimals | VAT (approx.) | Local payment scheme | Notes |
|---|---|---|---|---|---|---|
| Kuwait | KW | KWD (د.ك) | **3** | None at the time of writing | **KNET** | Bleems' home market. Addresses use governorate / area / block |
| Saudi Arabia | SA | SAR (ر.س) | 2 | 15% | **mada**, STC Pay | Largest market. Arabic-first. National Address. E-invoicing (ZATCA) rules apply to local sellers |
| UAE | AE | AED (د.إ) | 2 | 5% | Cards, Apple Pay | Most international; English widely used |
| Qatar | QA | QAR (ر.ق) | 2 | None at the time of writing | NAPS / cards | |
| Bahrain | BH | BHD (د.ب) | **3** | 10% | **BenefitPay** | |
| Oman | OM | OMR (ر.ع.) | **3** | 5% | Cards / OmanNet | |

**Implementation notes**
- Store money as integer **minor units** with per-currency decimals (KWD, BHD and OMR use 3 decimals, so 1 KWD = 1000 fils).
- Display: `12.500 KWD` / `١٢٫٥٠٠ د.ك` in Arabic. Let the user choose Western or Arabic-Indic digits (default: Western digits even in Arabic is common on e-commerce sites).
- Decide whether prices shown are **VAT-inclusive** (recommended for consumer trust).

## Payments
| Need | Options |
|---|---|
| GCC-wide gateway with local methods | **Tap Payments**, **MyFatoorah**, **Checkout.com**, **PayTabs**, HyperPay |
| Must-have methods | Visa / Mastercard, Apple Pay, KNET (KW), mada (SA), BenefitPay (BH) |
| Buy-now-pay-later | **Tabby**, **Tamara** (very popular in KSA / UAE), P1 |
| Cash on delivery | Common in the GCC, but **risky for cross-border** shipments. Only allow for local hub stock |

Recommendation: **Tap Payments or MyFatoorah**, because both cover KNET, mada, Benefit and Apple Pay across the GCC.
Confirm they can onboard the actual legal entity (Indian vs GCC company) under decision D-004.

## Language and design
- Arabic is mandatory. Full **RTL mirroring** (icons, arrows, carousels, progress steps).
- Arabic fonts: e.g. *IBM Plex Sans Arabic*, *Tajawal*, *Noto Kufi Arabic*, *Cairo*. Pair with the English brand font.
- Gulf Arabic tone. Use a native Gulf copywriter for the final Arabic text.
- Optional Hindi / Urdu for the South Asian expat audience (P2). Urdu is also RTL.

## Gifting calendar (campaign planning)
| Occasion | Timing | Notes |
|---|---|---|
| **Ramadan** | Lunar, moves ~11 days earlier each year | Biggest season: hampers, décor, lanterns, corporate gifts. Campaign starts ~3 weeks before |
| **Eid al-Fitr** | End of Ramadan | Eidiya gifts, new clothes |
| **Eid al-Adha** | ~70 days after Eid al-Fitr | |
| Kuwait National & Liberation Day | 25–26 Feb | Blue/green/red/white themed products |
| Saudi Founding Day / National Day | 22 Feb / 23 Sep | Green themes |
| UAE National Day | 2 Dec | |
| Qatar National Day | 18 Dec | |
| Bahrain National Day | 16–17 Dec | |
| Oman National Day | 18–20 Nov | |
| Mother's Day (Arab world) | 21 Mar | Huge for gifting |
| Valentine's Day | 14 Feb | Popular with expats; tone down for local audiences |
| Back to school, graduations | Jun / Sep | |
| Diwali, Eid for South Asian expats | Varies | Expat segment |
| Wedding season | Winter months | Nikah gifts, trousseau sarees |

## Cultural guidelines
- Modest model photography; avoid alcohol, pork, gambling, and religious or political sensitivities.
- Use maps and borders carefully (avoid disputed-territory maps).
- Islamic calligraphy products: handle with respect (no placement on floor items, footwear, etc.).
- Premium packaging and presentation matter a lot. Gift wrap is a key upsell.

## Marketing channels
- Instagram, **Snapchat** (strong in KSA / KW), TikTok, WhatsApp Business, Google Ads (Arabic + English keywords)
- Influencers ("fashionistas") in Kuwait and KSA are highly effective. Budget for them.
