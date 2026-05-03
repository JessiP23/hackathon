-- InfraStreet — Demo: 10 NYC vendors + 30 active flash deals (Brooklyn / Queens / Manhattan)
-- Run in Supabase SQL editor after migrate.sql. Safe to re-run after deleting seed rows (see bottom).
--
-- Update media_url later with your Supabase Storage public URLs for food photos.
-- Phones are dummy E.164 (+1 718/212/347…) for demo rows only.

BEGIN;

-- Older databases may have been created before vendors.status existed; CREATE TABLE IF NOT EXISTS
-- does not add new columns. Keep seed portable with Supabase / partial migrations.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_menu';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS menu_image_url TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,2) DEFAULT 100;

-- Optional cleanup (uncomment if re-seeding)
-- DELETE FROM flash_deals WHERE id LIKE 'fd_seed_nyc_%';
-- DELETE FROM menus WHERE vendor_id LIKE 'v_seed_nyc_%';
-- DELETE FROM vendors WHERE id LIKE 'v_seed_nyc_%';

INSERT INTO vendors (id, name, phone, location, business_hours, status)
VALUES
  ('v_seed_nyc_01', 'Los Tacos del Este', '+17185550101',
   ST_SetSRID(ST_MakePoint(-73.9565, 40.7081), 4326)::geography, 'Daily 11a–10p', 'active'),
  ('v_seed_nyc_02', 'Astoria Dumpling House', '+17185550102',
   ST_SetSRID(ST_MakePoint(-73.9234, 40.7621), 4326)::geography, 'Daily 10a–9p', 'active'),
  ('v_seed_nyc_03', 'LES Hand-Roll Bar', '+12125550103',
   ST_SetSRID(ST_MakePoint(-73.9912, 40.7153), 4326)::geography, 'Tue–Sun 12p–11p', 'active'),
  ('v_seed_nyc_04', 'Jackson Halal Cart', '+13475550104',
   ST_SetSRID(ST_MakePoint(-73.8927, 40.7475), 4326)::geography, 'Daily 11a–2a', 'active'),
  ('v_seed_nyc_05', 'Bushwick Arepa Co', '+17185550105',
   ST_SetSRID(ST_MakePoint(-73.9192, 40.6948), 4326)::geography, 'Daily 9a–8p', 'active'),
 ('v_seed_nyc_06', 'Flushing Soup Dumplings', '+17185550106',
   ST_SetSRID(ST_MakePoint(-73.8301, 40.7614), 4326)::geography, 'Daily 10:30a–9:30p', 'active'),
  ('v_seed_nyc_07', 'Crown Jerk Shack', '+17185550107',
   ST_SetSRID(ST_MakePoint(-73.9442, 40.6681), 4326)::geography, 'Thu–Sun 12p–10p', 'active'),
  ('v_seed_nyc_08', 'LIC Slice Social', '+17185550108',
   ST_SetSRID(ST_MakePoint(-73.9489, 40.7445), 4326)::geography, 'Daily 11a–10p', 'active'),
  ('v_seed_nyc_09', 'East Village Banh Mi', '+12125550109',
   ST_SetSRID(ST_MakePoint(-73.9843, 40.7264), 4326)::geography, 'Daily 10a–9p', 'active'),
  ('v_seed_nyc_10', 'Sunset Park Tamales', '+17185550110',
   ST_SetSRID(ST_MakePoint(-74.0105, 40.6456), 4326)::geography, 'Fri–Sun 9a–7p', 'active')
ON CONFLICT (phone) DO NOTHING;

-- Two menu anchors per vendor (deals reference realistic items)
INSERT INTO menus (id, vendor_id, item_name, description, price, is_available) VALUES
  ('m_seed_nyc_0101', 'v_seed_nyc_01', 'Birria tacos (3)', 'Corn tortillas, consomé', 14.00, true),
  ('m_seed_nyc_0102', 'v_seed_nyc_01', 'Quesabirria', 'Dipped taco', 12.00, true),
  ('m_seed_nyc_0201', 'v_seed_nyc_02', 'Pork soup dumplings (6)', NULL, 11.00, true),
  ('m_seed_nyc_0202', 'v_seed_nyc_02', 'Scallion pancake', NULL, 6.50, true),
  ('m_seed_nyc_0301', 'v_seed_nyc_03', 'Salmon hand roll', NULL, 16.00, true),
  ('m_seed_nyc_0302', 'v_seed_nyc_03', 'Spicy tuna roll', NULL, 14.00, true),
  ('m_seed_nyc_0401', 'v_seed_nyc_04', 'Chicken over rice', 'White & red sauce', 10.00, true),
  ('m_seed_nyc_0402', 'v_seed_nyc_04', 'Lamb gyro', NULL, 11.00, true),
  ('m_seed_nyc_0501', 'v_seed_nyc_05', 'Pulled chicken arepa', NULL, 11.50, true),
  ('m_seed_nyc_0502', 'v_seed_nyc_05', 'Black bean & cheese arepa', NULL, 9.50, true),
  ('m_seed_nyc_0601', 'v_seed_nyc_06', 'Xiao long bao (8)', NULL, 13.00, true),
  ('m_seed_nyc_0602', 'v_seed_nyc_06', 'Beef noodle soup', NULL, 15.00, true),
  ('m_seed_nyc_0701', 'v_seed_nyc_07', 'Jerk chicken quarter', NULL, 13.00, true),
  ('m_seed_nyc_0702', 'v_seed_nyc_07', 'Curry goat plate', NULL, 16.00, true),
  ('m_seed_nyc_0801', 'v_seed_nyc_08', 'Cheese slice', NULL, 4.00, true),
  ('m_seed_nyc_0802', 'v_seed_nyc_08', 'Grandma pepperoni slice', NULL, 5.50, true),
  ('m_seed_nyc_0901', 'v_seed_nyc_09', 'Pork banh mi', NULL, 10.00, true),
  ('m_seed_nyc_0902', 'v_seed_nyc_09', 'Tofu banh mi', NULL, 9.00, true),
  ('m_seed_nyc_1001', 'v_seed_nyc_10', 'Pork tamale', NULL, 5.00, true),
  ('m_seed_nyc_1002', 'v_seed_nyc_10', 'Chicken tamale', NULL, 5.00, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO flash_deals (
  id, vendor_id, item_name, original_price, deal_price, discount_pct,
  remaining_quantity, total_quantity, start_at, end_at, status, radius_miles, media_url, location
) VALUES
  ('fd_seed_nyc_001', 'v_seed_nyc_01', 'Birria tacos (3)', 14.00, 9.00, NULL, 20, 20, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9565, 40.7081), 4326)::geography),
  ('fd_seed_nyc_002', 'v_seed_nyc_01', 'Quesabirria', 12.00, 8.00, NULL, 18, 18, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9565, 40.7081), 4326)::geography),
  ('fd_seed_nyc_003', 'v_seed_nyc_01', 'Birria tacos (3)', 14.00, 9.50, NULL, 15, 15, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9565, 40.7081), 4326)::geography),
  ('fd_seed_nyc_004', 'v_seed_nyc_02', 'Pork soup dumplings (6)', 11.00, 8.00, NULL, 24, 24, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9234, 40.7621), 4326)::geography),
  ('fd_seed_nyc_005', 'v_seed_nyc_02', 'Scallion pancake', 6.50, 4.00, NULL, 30, 30, NOW(), NOW() + INTERVAL '5 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9234, 40.7621), 4326)::geography),
  ('fd_seed_nyc_006', 'v_seed_nyc_02', 'Pork soup dumplings (6)', 11.00, 7.50, NULL, 20, 20, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9234, 40.7621), 4326)::geography),
  ('fd_seed_nyc_007', 'v_seed_nyc_03', 'Salmon hand roll', 16.00, 12.00, NULL, 14, 14, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9912, 40.7153), 4326)::geography),
  ('fd_seed_nyc_008', 'v_seed_nyc_03', 'Spicy tuna roll', 14.00, 10.00, NULL, 16, 16, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9912, 40.7153), 4326)::geography),
  ('fd_seed_nyc_009', 'v_seed_nyc_03', 'Salmon hand roll', 16.00, 11.00, NULL, 12, 12, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9912, 40.7153), 4326)::geography),
  ('fd_seed_nyc_010', 'v_seed_nyc_04', 'Chicken over rice', 10.00, 7.00, NULL, 40, 40, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8927, 40.7475), 4326)::geography),
  ('fd_seed_nyc_011', 'v_seed_nyc_04', 'Lamb gyro', 11.00, 8.00, NULL, 28, 28, NOW(), NOW() + INTERVAL '5 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8927, 40.7475), 4326)::geography),
  ('fd_seed_nyc_012', 'v_seed_nyc_04', 'Chicken over rice', 10.00, 7.50, NULL, 35, 35, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8927, 40.7475), 4326)::geography),
  ('fd_seed_nyc_013', 'v_seed_nyc_05', 'Pulled chicken arepa', 11.50, 8.50, NULL, 22, 22, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9192, 40.6948), 4326)::geography),
  ('fd_seed_nyc_014', 'v_seed_nyc_05', 'Black bean & cheese arepa', 9.50, 7.00, NULL, 25, 25, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9192, 40.6948), 4326)::geography),
  ('fd_seed_nyc_015', 'v_seed_nyc_05', 'Pulled chicken arepa', 11.50, 8.00, NULL, 18, 18, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9192, 40.6948), 4326)::geography),
  ('fd_seed_nyc_016', 'v_seed_nyc_06', 'Xiao long bao (8)', 13.00, 9.00, NULL, 26, 26, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8301, 40.7614), 4326)::geography),
  ('fd_seed_nyc_017', 'v_seed_nyc_06', 'Beef noodle soup', 15.00, 11.00, NULL, 18, 18, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8301, 40.7614), 4326)::geography),
  ('fd_seed_nyc_018', 'v_seed_nyc_06', 'Xiao long bao (8)', 13.00, 9.50, NULL, 20, 20, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.8301, 40.7614), 4326)::geography),
  ('fd_seed_nyc_019', 'v_seed_nyc_07', 'Jerk chicken quarter', 13.00, 9.00, NULL, 20, 20, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9442, 40.6681), 4326)::geography),
  ('fd_seed_nyc_020', 'v_seed_nyc_07', 'Curry goat plate', 16.00, 12.00, NULL, 14, 14, NOW(), NOW() + INTERVAL '5 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9442, 40.6681), 4326)::geography),
  ('fd_seed_nyc_021', 'v_seed_nyc_07', 'Jerk chicken quarter', 13.00, 9.50, NULL, 16, 16, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9442, 40.6681), 4326)::geography),
  ('fd_seed_nyc_022', 'v_seed_nyc_08', 'Cheese slice', 4.00, 2.50, NULL, 50, 50, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9489, 40.7445), 4326)::geography),
  ('fd_seed_nyc_023', 'v_seed_nyc_08', 'Grandma pepperoni slice', 5.50, 4.00, NULL, 40, 40, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9489, 40.7445), 4326)::geography),
  ('fd_seed_nyc_024', 'v_seed_nyc_08', 'Cheese slice', 4.00, 2.75, NULL, 45, 45, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9489, 40.7445), 4326)::geography),
  ('fd_seed_nyc_025', 'v_seed_nyc_09', 'Pork banh mi', 10.00, 7.50, NULL, 30, 30, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9843, 40.7264), 4326)::geography),
  ('fd_seed_nyc_026', 'v_seed_nyc_09', 'Tofu banh mi', 9.00, 6.50, NULL, 24, 24, NOW(), NOW() + INTERVAL '6 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9843, 40.7264), 4326)::geography),
  ('fd_seed_nyc_027', 'v_seed_nyc_09', 'Pork banh mi', 10.00, 7.00, NULL, 28, 28, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-73.9843, 40.7264), 4326)::geography),
  ('fd_seed_nyc_028', 'v_seed_nyc_10', 'Pork tamale', 5.00, 3.50, NULL, 40, 40, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-74.0105, 40.6456), 4326)::geography),
  ('fd_seed_nyc_029', 'v_seed_nyc_10', 'Chicken tamale', 5.00, 3.50, NULL, 40, 40, NOW(), NOW() + INTERVAL '5 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-74.0105, 40.6456), 4326)::geography),
  ('fd_seed_nyc_030', 'v_seed_nyc_10', 'Pork tamale', 5.00, 3.50, NULL, 35, 35, NOW(), NOW() + INTERVAL '7 days', 'active', 10, NULL,
   ST_SetSRID(ST_MakePoint(-74.0105, 40.6456), 4326)::geography)
ON CONFLICT (id) DO NOTHING;

COMMIT;
