# 03 · India Market Knowledge

> ⚠️ Tax, payment and legal facts change. Written Nov 2026. **Verify before launch** with a CA.

## Money
- Currency **INR (₹)**, 2 decimals (paise). Store as integer paise.
- Show prices **inclusive of GST** ("MRP / price incl. of all taxes"), which Indian shoppers expect.
- Display: `₹1,499`. Use the Indian digit grouping (`₹1,24,999`) via `Intl.NumberFormat('en-IN')`.

## Payments
| Method | Notes |
|---|---|
| **UPI** (GPay, PhonePe, Paytm, BHIM) | The #1 online payment method in India. Must be first and easiest |
| Debit / credit cards, RuPay | Standard |
| Net banking, wallets | Supported by gateways |
| **Cash on Delivery (COD)** | Still very common, especially outside metros. Higher return/RTO risk. Consider a COD fee or prepaid discount |
| Pay later / EMI | Simpl, LazyPay, card EMI. Later phase |

Gateways: **Razorpay** (recommended: easy onboarding, UPI, payment links, good for small businesses), Cashfree, PayU, PhonePe PG.
Stage A: send a **Razorpay Payment Link or UPI QR** on WhatsApp after the order is confirmed.

## Languages
- **English** for the website at launch; many urban shoppers browse in English.
- **Hindi** version later (large reach in North India).
- **Urdu** (Nastaliq) in branding, packaging and storytelling: it is the language of Azamgarh's poets and our family.

## Gifting calendar (campaign planning)
| Occasion | Timing (approx.) | Gift ideas |
|---|---|---|
| Valentine's week | 7–14 Feb | Couples, friends |
| Holi | Feb/Mar | Colourful décor, hampers |
| Women's Day | 8 Mar | Gifts for her |
| Eid al-Fitr | Lunar, moves ~11 days earlier each year | Eidi gifts, hampers, dupattas |
| Mother's Day | 2nd Sunday of May | Silk, décor |
| Eid al-Adha | ~70 days after Eid al-Fitr | |
| Friendship Day | 1st Sunday of Aug | Students |
| **Raksha Bandhan** | Aug | Gifts for sisters: big for us |
| Independence Day | 15 Aug | |
| Teachers' Day | 5 Sep | Students gifting teachers |
| Karva Chauth | Oct/Nov | |
| **Diwali** | Oct/Nov | Biggest season: diyas, black pottery, hampers, corporate gifts |
| Bhai Dooj | 2 days after Diwali | |
| **Wedding season** | Nov–Feb | Nikah/wedding gifts, silk sarees, trousseau |
| Christmas / New Year | Dec | |
| Birthdays, anniversaries, housewarming | All year | Evergreen rails |

## Audience
- Girls, women and students (18–35) in metros and Tier-2 cities, buying for sisters, mothers, friends and teachers.
- Diaspora from Azamgarh and UP living in other Indian cities (nostalgia, weddings, Eid).
- Corporate Diwali gifting (later).

## Marketing channels
- **Instagram** (Reels of the making process!), **WhatsApp Business** (catalogue, broadcast), YouTube Shorts
- Meta ads, Google Shopping (later)
- Micro-influencers (student, lifestyle, home décor)
- Marketplaces later: Amazon Karigar, Flipkart Samarth, Etsy India (verify programme availability)

## Reference Indian gift sites
FNP (Ferns N Petals), IGP, Archies, Bigsmall, plus craft stores iTokri, Jaypore, Okhai, Gaatha (see `01-reference-websites.md`).
