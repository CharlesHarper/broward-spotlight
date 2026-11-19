-- Automatic enrichment: OpenStreetMap details and facts read from the business's own website
ALTER TABLE businesses ADD COLUMN website_source TEXT;      -- owner | osm | auto
ALTER TABLE businesses ADD COLUMN contact_email TEXT;        -- private: used only for the claim invitation, never shown
ALTER TABLE businesses ADD COLUMN osm_id TEXT;
ALTER TABLE businesses ADD COLUMN enrich_checked_at TEXT;
ALTER TABLE businesses ADD COLUMN invited_at TEXT;
CREATE INDEX idx_biz_latlng ON businesses(lat, lng);
CREATE INDEX idx_biz_enrich ON businesses(enrich_checked_at, status);
