-- Vendor Telegram DM target (Twilio not used for stalls that use the bot).
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS vendors_telegram_chat_id_idx
  ON vendors(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- Backfill from legacy tg:<id> phones
UPDATE vendors
SET telegram_chat_id = CAST(SUBSTRING(phone FROM 4) AS BIGINT)
WHERE phone LIKE 'tg:%'
  AND telegram_chat_id IS NULL
  AND SUBSTRING(phone FROM 4) ~ '^[0-9]+$';
