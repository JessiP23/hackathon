-- Vendor Telegram FSM + Brain: neighborhoods, floors, deal origin, end-of-deal notice flag

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS brain_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS brain_urgency_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.55;

ALTER TABLE menus ADD COLUMN IF NOT EXISTS price_floor NUMERIC(10,2);

ALTER TABLE flash_deals ADD COLUMN IF NOT EXISTS deal_origin TEXT NOT NULL DEFAULT 'vendor';
ALTER TABLE flash_deals ADD COLUMN IF NOT EXISTS brain_why TEXT;
ALTER TABLE flash_deals ADD COLUMN IF NOT EXISTS brain_urgency_factors JSONB;
ALTER TABLE flash_deals ADD COLUMN IF NOT EXISTS vendor_end_notified_at TIMESTAMPTZ;

ALTER TABLE flash_deals DROP CONSTRAINT IF EXISTS flash_deals_deal_origin_check;
ALTER TABLE flash_deals ADD CONSTRAINT flash_deals_deal_origin_check
  CHECK (deal_origin IN ('vendor', 'brain'));
