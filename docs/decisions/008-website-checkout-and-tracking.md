# 008 · Website cart, checkout, UPI pay screen and order tracking

**Date:** 2026-11-04 · **Status:** accepted

## Decision
Customers can now order on the website without an account (guest checkout):

1. **Cart** in the browser (localStorage), "Add to cart" / "Buy now" on each priced, in-stock product.
2. **Checkout** (`/checkout/`): name, 10-digit mobile, address, city, state, 6-digit PIN, optional email,
   gift message and notes, plus a privacy-policy consent tick (DPDP Act 2023).
3. `POST /api/order` re-reads prices, stock and status from D1 (never trusts the browser), adds the delivery charge
   from Settings, saves the order as `source = 'website'`, takes the stock, and limits spam to 5 orders/hour per IP.
4. **Order page** (`/order/`): order number, **Pay by UPI** button (`upi://pay` link with amount and order number) when a
   UPI ID is set in Settings, a box for the customer's 12-digit UTR, and a WhatsApp button.
5. **Track page** (`/track/`): order number + mobile number → status timeline, courier and tracking link.
6. **Policies**: `/policies/privacy/`, `/policies/shipping-returns/`, `/policies/terms/`. Business facts the owner has not
   confirmed are shown as highlighted `[owner to confirm]` placeholders (rule 7).

Payment is confirmed by hand: the team checks the bank app and sets the order to *Paid* in the admin.

## Not yet
Customer login (WhatsApp reverse-OTP), automatic payment confirmation (Razorpay), Shiprocket booking/tracking.
