-- Fix: POST /users fails with column "referral_code" does not exist
-- Run once in Supabase SQL Editor (or psql) on your project DB.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx ON users (referral_code)
    WHERE referral_code IS NOT NULL AND referral_code <> '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reward_points INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by_user_id);
