-- 0003: customer accounts, occasions, coupons, enquiries, partner integrations (encrypted keys),
-- webhooks, admin two-step login and session details.

-- ---------- Occasions (Haldi, Mehndi, Nikah, Birthday, Diwali…) ----------
CREATE TABLE IF NOT EXISTS occasions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  urdu TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'rani',
  grp TEXT NOT NULL DEFAULT 'celebration' CHECK (grp IN ('wedding','festival','celebration')),
  image_key TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO occasions (slug, name, urdu, blurb, color, grp, sort) VALUES
  ('haldi', 'Haldi', 'ہلدی', 'Bright marigold gifts and favours for the haldi ceremony.', 'marigold', 'wedding', 10),
  ('mehndi', 'Mehndi', 'مہندی', 'Handmade gifts and return favours for the mehndi night.', 'peacock', 'wedding', 20),
  ('wedding-nikah', 'Wedding & Nikah', 'نکاح', 'Heirloom pieces for the bride, the groom and the families.', 'plum', 'wedding', 30),
  ('return-gifts', 'Return gifts', 'تحفہ', 'Small handmade favours for your guests, in bulk.', 'rose', 'wedding', 40),
  ('birthday', 'Birthday', '', 'Gifts she will remember, wrapped by hand.', 'lilac', 'celebration', 50),
  ('anniversary', 'Anniversary', '', 'Timeless handmade pieces for the two of you.', 'rani', 'celebration', 60),
  ('housewarming', 'Housewarming', '', 'Décor and pottery for a new home.', 'peacock', 'celebration', 70),
  ('baby-shower', 'Baby shower', '', 'Gentle, handmade gifts for the new mother.', 'rose', 'celebration', 80),
  ('thank-you', 'Thank you', 'شکریہ', 'Small gestures that say a lot.', 'marigold', 'celebration', 90),
  ('eid', 'Eid', 'عید', 'Eidi and gifts for the whole family.', 'peacock', 'festival', 100),
  ('diwali', 'Diwali', '', 'Diyas, décor and hampers for the festival of lights.', 'marigold', 'festival', 110),
  ('raksha-bandhan', 'Raksha Bandhan', '', 'Gifts for your sister, from the heart.', 'rani', 'festival', 120),
  ('mothers-day', 'Mother''s Day', '', 'For Ammi, Maa and Mummy.', 'rose', 'festival', 130);

-- Products now store occasion slugs (they stored display names before).
UPDATE products SET occasions =
  replace(replace(replace(replace(replace(replace(replace(replace(occasions,
    'Raksha Bandhan', 'raksha-bandhan'), 'Wedding & Nikah', 'wedding-nikah'), 'Mother''s Day', 'mothers-day'),
    'Thank You', 'thank-you'), 'Diwali', 'diwali'), 'Eid', 'eid'), 'Birthday', 'birthday'), 'Anniversary', 'anniversary');

-- ---------- Customer accounts ----------
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL DEFAULT '',
  pass_salt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','deleted')),
  cart TEXT NOT NULL DEFAULT '[]',
  wishlist TEXT NOT NULL DEFAULT '[]',
  marketing INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT NOT NULL DEFAULT '',
  last_login_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_csessions_customer ON customer_sessions(customer_id);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON customer_addresses(customer_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  ip TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

CREATE TABLE IF NOT EXISTS customer_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE orders ADD COLUMN customer_id INTEGER;
ALTER TABLE orders ADD COLUMN coupon_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN occasion TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'upi';
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);

-- ---------- Coupons ----------
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  kind TEXT NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','flat')),
  value INTEGER NOT NULL,
  min_order INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER,
  per_customer INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Event & bulk order enquiries ----------
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  occasion TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  quantity INTEGER,
  budget TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','won','lost')),
  admin_note TEXT NOT NULL DEFAULT '',
  customer_id INTEGER,
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Partner integrations: keys are AES-GCM encrypted with the SECRETS_KEY server secret ----------
CREATE TABLE IF NOT EXISTS integrations (
  provider TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  config TEXT NOT NULL DEFAULT '{}',
  secrets TEXT NOT NULL DEFAULT '',
  last_test_at TEXT,
  last_test_ok INTEGER,
  last_test_msg TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outgoing webhooks (we call your URL when something happens, signed with a secret).
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '',
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_status INTEGER,
  last_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of webhooks received from partners and sent to your URLs.
CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  source TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL DEFAULT 0,
  status INTEGER,
  detail TEXT NOT NULL DEFAULT '',
  event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wlog_event ON webhook_log(source, event_id);

-- ---------- Admin security: two-step login and session details ----------
ALTER TABLE admin_users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_users ADD COLUMN totp_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN totp_last INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ip TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN ua TEXT NOT NULL DEFAULT '';

-- ---------- New settings ----------
INSERT OR IGNORE INTO settings (key, value) VALUES ('require_login', '0'), ('cod_enabled', '0'), ('cod_fee', ''), ('hold_hours', '48');
