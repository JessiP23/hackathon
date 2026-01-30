CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  item_name TEXT,
  price NUMERIC
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  vendor_id TEXT,
  customer_phone TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  vendor_id TEXT,
  item_name TEXT,
  deal_price NUMERIC,
  expires_at TIMESTAMP,
  location GEOGRAPHY(POINT, 4326)
);
