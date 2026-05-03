-- Fix GET /deals: column d.pickup_area does not exist
ALTER TABLE flash_deals ADD COLUMN IF NOT EXISTS pickup_area TEXT;
