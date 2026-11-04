-- Website checkout: gift message, customer IP (for spam limits), delivery settings.
ALTER TABLE orders ADD COLUMN gift_message TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN ip TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(number);
INSERT OR IGNORE INTO settings (key, value) VALUES ('shipping_fee', ''), ('free_shipping_above', '');
