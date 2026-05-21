-- Add optional `extras` JSON column to requests and `extras_config` JSON column to rooms.
-- Both are nullable; absence means "no extras" / "use defaults". Storing as TEXT (JSON
-- string) matches how `chat_tiers` and `priority` are persisted on `rooms`.
ALTER TABLE requests ADD COLUMN extras TEXT;
ALTER TABLE rooms    ADD COLUMN extras_config TEXT;
