-- 0004 · Open handmade marketplace, phase 1 (decision 010, docs/knowledge-base/10-marketplace-plan.md)
-- Sellers (one per customer account), products owned by sellers, admin review, category requests, seller activity log.
-- Safe to run once on the live database: only adds tables/columns; existing products move to seller #1 "Insi House Originals".

CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER UNIQUE REFERENCES customers(id),      -- NULL only for the house shop (seller #1)
  slug TEXT NOT NULL UNIQUE,
  -- Public (shown to buyers)
  shop_name TEXT NOT NULL DEFAULT '',
  maker_name TEXT NOT NULL DEFAULT '',                       -- first name / display name
  story TEXT NOT NULL DEFAULT '',
  craft TEXT NOT NULL DEFAULT '',                            -- "embroidery, block print"
  district TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  photo_key TEXT,
  show_photo INTEGER NOT NULL DEFAULT 1,
  -- Private (admin only)
  full_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  pincode TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account TEXT NOT NULL DEFAULT '',
  bank_ifsc TEXT NOT NULL DEFAULT '',
  pan TEXT NOT NULL DEFAULT '',
  gst_type TEXT NOT NULL DEFAULT 'none',                     -- none | enrolment | gstin
  gst_id TEXT NOT NULL DEFAULT '',
  -- Shipping (used from phase 2)
  ship_fee INTEGER NOT NULL DEFAULT 0,
  free_ship_above INTEGER,
  dispatch_days INTEGER NOT NULL DEFAULT 3,
  cod INTEGER NOT NULL DEFAULT 0,
  holiday INTEGER NOT NULL DEFAULT 0,
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',                      -- draft | pending | approved | changes | rejected | suspended
  review_note TEXT NOT NULL DEFAULT '',                      -- message to the seller
  admin_note TEXT NOT NULL DEFAULT '',                       -- private admin note
  undertaking_at TEXT,
  submitted_at TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);

INSERT INTO sellers (id, customer_id, slug, shop_name, maker_name, story, craft, district, state, status, approved_at)
SELECT 1, NULL, 'insi-house-originals', 'Insi House Originals', 'Insi House family',
       'Handmade by our family in Azamgarh, Uttar Pradesh.', 'Black pottery, silk, embroidery', 'Azamgarh', 'Uttar Pradesh', 'approved', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM sellers WHERE id = 1);

ALTER TABLE products ADD COLUMN seller_id INTEGER REFERENCES sellers(id);
ALTER TABLE products ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';   -- pending | approved | changes | rejected
ALTER TABLE products ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN made_by TEXT NOT NULL DEFAULT 'me';               -- me | family | group
ALTER TABLE products ADD COLUMN technique TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN materials TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN made_to_order_days INTEGER;
ALTER TABLE products ADD COLUMN requested_category TEXT NOT NULL DEFAULT '';
UPDATE products SET seller_id = 1 WHERE seller_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_review ON products(review_status);

ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id);
INSERT INTO categories (slug, name, sub, art, color, sort, visible)
SELECT 'other', 'Other handmade', 'Something special', 'gift', 'lilac', 9999, 1
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'other');

CREATE TABLE IF NOT EXISTS category_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',                    -- pending | approved | rejected
  category_id INTEGER REFERENCES categories(id),            -- the category it became / was merged into
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_catreq_status ON category_requests(status);

CREATE TABLE IF NOT EXISTS seller_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  actor TEXT NOT NULL DEFAULT 'seller',                      -- seller | admin:<name>
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_selleract_seller ON seller_activity(seller_id, id);
