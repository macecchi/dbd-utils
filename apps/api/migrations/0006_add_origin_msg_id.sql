-- Track which donation a request came from so multi-request donations can
-- be grouped in the UI. Nullable: existing rows and non-donation rows stay NULL.
ALTER TABLE requests ADD COLUMN origin_msg_id TEXT;
CREATE INDEX IF NOT EXISTS idx_requests_origin_msg_id ON requests(origin_msg_id);
