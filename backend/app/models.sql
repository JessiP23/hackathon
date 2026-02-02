CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (customers + vendors)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'vendor')),
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  business_hours TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Menus table
CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  customer_id TEXT REFERENCES users(id),
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC,
  status TEXT DEFAULT 'pending',
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP DEFAULT now()
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  original_price NUMERIC,
  deal_price NUMERIC NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_deals_location ON deals USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);