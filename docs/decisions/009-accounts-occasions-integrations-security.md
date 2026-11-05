# 009 · Customer accounts, occasions, partner keys and security hardening

**Date:** 5 Nov 2026 · **Status:** accepted

## Context
The owner shared reference screenshots of another admin panel (grouped sidebar, dashboard with Week/Month/Year,
customers incl. deleted accounts, coupons, payments list, webhooks list, users & permissions, order statuses) and asked for:
a better admin, customer accounts like Flipkart/Amazon/Meesho (login, cart, saved data), occasion shopping
(wedding, haldi, mehndi, birthday…), a place to paste payment / courier keys later instead of editing secret files,
and strong security so nobody can change the data.

## Decisions
1. **Customer accounts** (`/account/`, `/api/account/*`): mobile number + password now; mobile + 6-digit code
   (WhatsApp Cloud API or MSG91) turns on automatically when the owner switches that partner on.
   Session = random token in an HttpOnly, Secure, SameSite=Lax cookie (`ih_cust`, path `/api`), stored hashed.
   Orders are linked by account id; older guest orders by phone **only after the phone is verified by a code**
   (so nobody can register someone else's number and see their orders). First code login on an unverified
   account removes the old password and logs out other devices.
   Cart and wishlist sync across devices; addresses (up to 10); delete account erases personal data (DPDP).
2. **Login before ordering** is a setting (`require_login`), **off by default** until login codes are connected,
   because password-only sign-up at checkout adds friction without proving the number.
3. **Occasions** are a managed table (13 seeded: haldi, mehndi, wedding & nikah, return gifts, birthday,
   anniversary, housewarming, baby shower, thank you, Eid, Diwali, Raksha Bandhan, Mother's Day) with their own
   pages `/occasion/<slug>/`. Products store occasion slugs (migration converted the old names).
   `/events/` collects wedding / bulk enquiries into the admin.
4. **Partner keys** (Payments, Shipping, WhatsApp & SMS pages): stored in D1 **encrypted with AES-256-GCM**
   using the `SECRETS_KEY` Pages secret, bound to the partner name. The browser only ever sees `••••1234`.
   Changing keys or switching a partner on needs the admin password; owner-only; every change is logged.
   Webhook receivers: `/api/hooks/razorpay` (HMAC signature, amount check, replay de-dupe),
   `/api/hooks/courier` (Shiprocket token; Shiprocket forbids its own name in URLs), `/api/hooks/whatsapp`.
   PhonePe, Cashfree and Delhivery are "keys only" until their checkout/booking is built.
5. **Outgoing webhooks** (order.created/updated/paid, enquiry.created, customer.created), HMAC-signed,
   https + public hosts only, secret shown once.
6. **Coupons** (percent/flat, minimum, cap, dates, total and per-customer limits), always re-checked on the server.
   **Cash on delivery** is a setting (off by default) with an optional fee.
7. **Admin security**: optional two-step login (TOTP authenticator app, QR in Security page), device list and
   "log out other devices", login history, owner can reset a staff member's 2-step, password change logs out
   other devices, uploads must really be JPG/PNG/WebP (magic bytes).
8. **Site-wide headers** (`public/_headers`): CSP, no framing, HSTS, nosniff, referrer policy; API responses add their own.

## Not done yet (needs the partner accounts)
Razorpay checkout button, Shiprocket booking from the admin, WhatsApp order messages, product reviews, CMS pages.
