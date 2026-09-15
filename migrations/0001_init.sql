-- World save table for the Cloudflare Worker (D1)
CREATE TABLE IF NOT EXISTS world (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
