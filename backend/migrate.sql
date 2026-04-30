-- InfraStreet — Full Schema Migration
-- Run once against Supabase (PostGIS must be enabled)
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT 'u_' || substr(md5(random()::text),1,8),
    phone       TEXT UNIQUE NOT NULL,
    role        TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'admin')),
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- InfraStreet — Full Schema Migration
-- Run once against Supabase (PostGIS must be enabled)

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── vendors ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    phone           TEXT UNIQUE NOT NULL,
    location        geography(POINT, 4326),
    business_hours  TEXT,
    timezone        TEXT DEFAULT 'UTC',
    status          TEXT DEFAULT 'awaiting_menu',
    slug            TEXT UNIQUE,
    menu_image_url  TEXT,
    reliability_score NUMERIC(5,2) DEFAULT 100,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vendors_location_idx ON vendors USING GIST (location);

-- ── menus ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
    id          TEXT PRIMARY KEY,
    vendor_id   TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    item_name   TEXT NOT NULL,
    description TEXT,
    price       NUMERIC(10,2),
    category    TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── flash_deals ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flash_deals (
    id                  TEXT PRIMARY KEY,
    vendor_id           TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    item_name           TEXT NOT NULL,
    original_price      NUMERIC(10,2),
    deal_price          NUMERIC(10,2),
    discount_pct        NUMERIC(5,2),
    remaining_quantity  INTEGER NOT NULL DEFAULT 0,
    total_quantity      INTEGER NOT NULL DEFAULT 0,
    start_at            TIMESTAMPTZ DEFAULT NOW(),
    end_at              TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','active','sold_out','expired','cancelled')),
    radius_miles        NUMERIC(6,2) DEFAULT 10,
    media_url           TEXT,
    location            geography(POINT, 4326),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flash_deals_location_idx ON flash_deals USING GIST (location);
CREATE INDEX IF NOT EXISTS flash_deals_status_idx ON flash_deals (status);
CREATE INDEX IF NOT EXISTS flash_deals_end_at_idx ON flash_deals (end_at);

-- ── customers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id                      TEXT PRIMARY KEY DEFAULT 'c_' || substr(md5(random()::text),1,8),
    phone                   TEXT UNIQUE NOT NULL,
    name                    TEXT,
    location                geography(POINT, 4326),
    notification_channel    TEXT DEFAULT 'sms',
    notifications_enabled   BOOLEAN DEFAULT true,
    radius_miles            NUMERIC(6,2) DEFAULT 10,
    reliability_score       NUMERIC(5,2) DEFAULT 100,
    fulfilled_orders        INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_location_idx ON customers USING GIST (location);

-- ── orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id                      TEXT PRIMARY KEY,
    vendor_id               TEXT REFERENCES vendors(id),
    customer_phone          TEXT,
    deal_id                 TEXT REFERENCES flash_deals(id),
    items                   JSONB,
    total                   NUMERIC(10,2),
    service_fee             NUMERIC(10,2),
    status                  TEXT NOT NULL DEFAULT 'pending_payment'
                                CHECK (status IN (
                                    'pending_payment','paid','payment_failed','expired',
                                    'fulfilled','refunded','reserved_unpaid','no_show','pending'
                                )),
    pickup_code             TEXT,
    stripe_payment_intent   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_vendor_idx ON orders (vendor_id);
CREATE INDEX IF NOT EXISTS orders_deal_idx ON orders (deal_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_phone);

-- v3.3 — rename legacy notification_logs → notifications (before CREATE IF NOT EXISTS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notification_logs RENAME TO notifications;
  END IF;
END $$;

-- ── notifications (deal ping audit trail; was notification_logs) ───────────
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    deal_id     TEXT REFERENCES flash_deals(id),
    vendor_id   TEXT REFERENCES vendors(id),
    channel     TEXT,
    sent_at     TIMESTAMPTZ DEFAULT NOW(),
    opened_at   TIMESTAMPTZ,
    converted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS notif_unique_idx ON notifications (customer_id, deal_id);
CREATE INDEX IF NOT EXISTS notif_sent_at_idx ON notifications (sent_at);

-- ── users (auth) ──────────────────────────────────────────────────────
-- existing table — add columns if needed
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_menu';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS menu_image_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS radius_miles NUMERIC(6,2) DEFAULT 10;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
    'pending_payment','paid','payment_failed','expired',
    'fulfilled','refunded','reserved_unpaid','no_show','pending'
));

-- v3.2 — customer Telegram + notification channel
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_id BIGINT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_telegram_id_uidx
    ON customers (telegram_id) WHERE telegram_id IS NOT NULL;
UPDATE customers SET notification_channel = 'sms'
WHERE notification_channel IS NULL
   OR notification_channel NOT IN ('sms', 'telegram', 'both');
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_notification_channel_check;
ALTER TABLE customers ADD CONSTRAINT customers_notification_channel_check
    CHECK (notification_channel IN ('sms', 'telegram', 'both'));
