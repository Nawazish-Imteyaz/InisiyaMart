// Shared shop logic: customer sessions and coupons (used by /api/account, /api/order and /api/coupon).
import { HttpError, mobile, readCookie, sha256, str, type D1Database } from "./util";

// ---------------- Customer sessions ----------------
export const CUSTOMER_COOKIE = "ih_cust";
export const CUSTOMER_DAYS = 30;

export interface Customer {
  id: number; phone: string; phone_verified: number; name: string; email: string; marketing: number; has_password: number; created_at: string;
}

export function customerCookie(token: string, maxAge: number): string {
  // Path=/api so only our API ever receives it; HttpOnly so page scripts can never read it.
  return `${CUSTOMER_COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** The logged-in customer, or null. Blocked and deleted accounts are treated as logged out. */
export async function currentCustomer(db: D1Database, req: Request): Promise<Customer | null> {
  const token = readCookie(req, CUSTOMER_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      `SELECT c.id, c.phone, c.phone_verified, c.name, c.email, c.marketing, (c.pass_hash != '') AS has_password, c.created_at
       FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND c.status = 'active'`,
    )
    .bind(await sha256(token))
    .first<Customer>();
}

// ---------------- Coupons ----------------
interface CouponRow {
  id: number; code: string; kind: "percent" | "flat"; value: number; min_order: number; max_discount: number | null;
  starts_at: string | null; ends_at: string | null; usage_limit: number | null; per_customer: number; used_count: number; active: number;
}

/** Validates a coupon for this cart and returns the discount in ₹. Throws a friendly error if it can't be used. */
export async function priceCoupon(
  db: D1Database, rawCode: unknown, subtotal: number, who: { customerId?: number | null; phone?: string },
): Promise<{ id: number; code: string; discount: number; label: string; perCustomer: number }> {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new HttpError(400, "That coupon code doesn't look right");
  const c = await db.prepare("SELECT * FROM coupons WHERE code = ?").bind(code).first<CouponRow>();
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); // India date
  if (!c || !c.active) throw new HttpError(404, "This coupon is not valid");
  if (c.starts_at && today < c.starts_at) throw new HttpError(400, "This coupon is not active yet");
  if (c.ends_at && today > c.ends_at) throw new HttpError(400, "This coupon has expired");
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) throw new HttpError(400, "This coupon has been fully used");
  if (subtotal < c.min_order) throw new HttpError(400, `Add items worth ₹${c.min_order - subtotal} more to use this coupon (minimum ₹${c.min_order})`);
  if (c.per_customer && (who.customerId || who.phone)) {
    const used = await db
      .prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_code = ? AND status != 'cancelled' AND (customer_id = ? OR phone = ?)")
      .bind(c.code, who.customerId ?? -1, who.phone ?? "-")
      .first<{ n: number }>();
    if ((used?.n ?? 0) >= c.per_customer) throw new HttpError(400, "You have already used this coupon");
  }
  let discount = c.kind === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
  if (c.max_discount !== null) discount = Math.min(discount, c.max_discount);
  discount = Math.max(0, Math.min(discount, subtotal));
  const label = c.kind === "percent" ? `${c.value}% off${c.max_discount !== null ? ` (up to ₹${c.max_discount})` : ""}` : `₹${c.value} off`;
  return { id: c.id, code: c.code, discount, label, perCustomer: c.per_customer };
}

// ---------------- Saved addresses ----------------
export function addressValues(body: Record<string, unknown>) {
  const phone = mobile(body.phone);
  if (!phone) throw new HttpError(400, "Enter a valid 10-digit mobile number");
  const pincode = str(body.pincode, 6, "PIN code", true);
  if (!/^[1-9][0-9]{5}$/.test(pincode)) throw new HttpError(400, "PIN code must be 6 digits");
  return {
    label: str(body.label ?? "Home", 20, "Label") || "Home",
    name: str(body.name, 100, "Name", true),
    phone,
    address: str(body.address, 400, "Address", true),
    city: str(body.city, 60, "City", true),
    state: str(body.state, 60, "State", true),
    pincode,
  };
}

export async function saveAddress(db: D1Database, customerId: number, body: Record<string, unknown>, makeDefault = false): Promise<number> {
  const v = addressValues(body);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?").bind(customerId).first<{ n: number }>();
  if ((count?.n ?? 0) >= 10) throw new HttpError(400, "You can save up to 10 addresses");
  const isDefault = makeDefault || (count?.n ?? 0) === 0 ? 1 : 0;
  const stmts = [];
  if (isDefault) stmts.push(db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").bind(customerId));
  stmts.push(db.prepare("INSERT INTO customer_addresses (customer_id, label, name, phone, address, city, state, pincode, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(customerId, v.label, v.name, v.phone, v.address, v.city, v.state, v.pincode, isDefault));
  const res = await db.batch(stmts);
  return res[res.length - 1].meta.last_row_id as number;
}

