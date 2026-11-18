-- Broward County Local Business Tax records: every licensed business in the county, all industries
ALTER TABLE businesses ADD COLUMN btr_account INTEGER;
ALTER TABLE businesses ADD COLUMN btr_category TEXT;
ALTER TABLE businesses ADD COLUMN started_on TEXT;
ALTER TABLE businesses ADD COLUMN lat REAL;
ALTER TABLE businesses ADD COLUMN lng REAL;
ALTER TABLE businesses ADD COLUMN hide_street INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_biz_btr ON businesses(btr_account);
CREATE TABLE import_state (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
