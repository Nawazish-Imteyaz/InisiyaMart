-- Sample data so the admin console starts with the current website content. Safe to edit or delete in the admin.
INSERT OR IGNORE INTO categories (slug, name, sub, art, color, sort) VALUES
  ('black-pottery', 'Black Pottery', 'Nizamabad craft', 'pot', 'ink', 1),
  ('silk-dupattas', 'Silk & Dupattas', 'Mubarakpur weaves', 'fabric', 'rani', 2),
  ('gift-hampers', 'Gift Hampers', 'Ready to gift', 'gift', 'marigold', 3),
  ('home-decor', 'Home Décor', 'Art & calligraphy', 'frame', 'peacock', 4),
  ('embroidery', 'Embroidery', 'Hand-embroidered', 'clutch', 'lilac', 5);

INSERT OR IGNORE INTO products (slug, name, category_id, collection, badge, summary, stock, track_stock, personalisable, tone, art, occasions, sort) VALUES
  ('etched-black-pottery-vase', 'Etched black pottery vase', (SELECT id FROM categories WHERE slug='black-pottery'), 'Nafees', 'Handmade', 'Glossy black clay with a hand-etched silver-coloured pattern, inspired by the pottery of Nizamabad, Azamgarh.', 0, 0, 1, 'ink', 'pot', 'Diwali,Wedding & Nikah,Anniversary', 1),
  ('silk-dupatta', 'Silk dupatta', (SELECT id FROM categories WHERE slug='silk-dupattas'), 'Tohfa', 'Handmade', 'A soft, elegant dupatta in the weaving tradition of Mubarakpur. A gift she will wear again and again.', 0, 0, 0, 'dusty', 'fabric', 'Raksha Bandhan,Eid,Mother''s Day', 2),
  ('festive-gift-hamper', 'Festive gift hamper', (SELECT id FROM categories WHERE slug='gift-hampers'), 'Tohfa', 'Gift set', 'A curated box of handmade pieces for Diwali, Eid or Rakhi, wrapped in our signature box with your message card.', 0, 0, 0, 'blush', 'gift', 'Diwali,Eid,Raksha Bandhan', 3),
  ('calligraphy-wall-frame', 'Calligraphy wall frame', (SELECT id FROM categories WHERE slug='home-decor'), 'Zauq', 'Personalised', 'Hand-made calligraphy art for the home, with a name or verse of your choice.', 0, 0, 1, 'mauve', 'frame', 'Wedding & Nikah,Eid', 4),
  ('black-pottery-tea-set', 'Black pottery tea set', (SELECT id FROM categories WHERE slug='black-pottery'), 'Nafees', 'Handmade', 'A decorative tea set in black clay with etched detailing, made to be displayed and admired.', 0, 0, 0, 'ink', 'pot', 'Anniversary,Wedding & Nikah', 5),
  ('embroidered-clutch', 'Embroidered clutch', (SELECT id FROM categories WHERE slug='embroidery'), 'Tohfa', 'Handmade', 'A hand-embroidered clutch for weddings, festivals and evenings out.', 0, 0, 0, 'rose', 'clutch', 'Birthday,Wedding & Nikah', 6),
  ('silk-cushion-covers', 'Silk cushion covers', (SELECT id FROM categories WHERE slug='silk-dupattas'), 'Zauq', 'Handmade', 'Handwoven silk cushion covers that bring warmth and colour to any room.', 0, 0, 0, 'dusty', 'fabric', 'Diwali,Thank You', 7),
  ('pottery-diya-set', 'Pottery diya set', (SELECT id FROM categories WHERE slug='black-pottery'), 'Nafees', 'Gift set', 'A set of black pottery diyas with etched patterns, beautiful for Diwali and festive evenings.', 0, 0, 0, 'plum', 'diya', 'Diwali', 8),
  ('name-calligraphy-plate', 'Name calligraphy plate', (SELECT id FROM categories WHERE slug='home-decor'), 'Khuloos', 'Personalised', 'A decorative plate with a name in English, Hindi or Urdu. A thoughtful thank-you gift.', 0, 0, 1, 'mauve', 'frame', 'Thank You,Birthday', 9);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('whatsapp', ''),
  ('email', ''),
  ('announcement', '✦ Handmade in Azamgarh · Delivered across India · Gift-wrapped with love ✦'),
  ('delivery', 'Delivered across India'),
  ('instagram', ''),
  ('upi_id', '');
