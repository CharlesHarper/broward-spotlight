-- Official city news and events, read from each city's own website feeds.
ALTER TABLE cities ADD COLUMN website TEXT;
ALTER TABLE cities ADD COLUMN news_feed TEXT;
ALTER TABLE cities ADD COLUMN events_feed TEXT;
ALTER TABLE cities ADD COLUMN feeds_checked_at TEXT;
CREATE TABLE city_items (id INTEGER PRIMARY KEY, city_slug TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, source TEXT, summary TEXT, published_at TEXT, starts_at TEXT, ends_at TEXT, time_text TEXT, location TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(kind, url));
CREATE INDEX idx_city_items ON city_items(city_slug, kind, starts_at, published_at);
