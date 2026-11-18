-- Broward Spotlight: initial schema

CREATE TABLE businesses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  subtype TEXT,
  address TEXT,
  city TEXT,
  city_slug TEXT,
  zip TEXT,
  phone TEXT,              -- public business phone (owner-provided or admin-verified)
  record_phone TEXT,       -- phone from the state record: used to verify claims, never shown publicly
  website TEXT,
  email TEXT,
  facebook TEXT,
  instagram TEXT,
  description TEXT,
  hours TEXT,
  license_holder TEXT,     -- licensee name on the state record
  source TEXT NOT NULL DEFAULT 'admin',   -- dbpr | owner | admin
  dbpr_license TEXT UNIQUE,
  dbpr_rank TEXT,
  license_status TEXT,
  license_expires TEXT,
  seats INTEGER,
  last_inspection_date TEXT,
  last_inspection_disposition TEXT,
  last_inspection_tone TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  owner_token TEXT UNIQUE,
  owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | pending | hidden | inactive (no active state license in latest import)
  record_seen_at TEXT,     -- last import run that saw this license
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_biz_city ON businesses(city_slug, status, name);
CREATE INDEX idx_biz_cat ON businesses(category, status, name);
CREATE INDEX idx_biz_city_cat ON businesses(city_slug, category, status);

CREATE TABLE inspections (
  id INTEGER PRIMARY KEY,
  visit_id TEXT NOT NULL UNIQUE,
  license_number TEXT NOT NULL,
  business_id INTEGER,
  inspection_number TEXT,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  type TEXT,
  disposition TEXT,
  tone TEXT,                    -- ok | warn | alert | neutral
  total_violations INTEGER,
  high_priority INTEGER,
  intermediate INTEGER,
  basic INTEGER
);
CREATE INDEX idx_insp_biz ON inspections(business_id, date DESC);
CREATE INDEX idx_insp_lic ON inspections(license_number, date DESC);
CREATE INDEX idx_insp_date ON inspections(date DESC, tone);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT UNIQUE,
  owner_response TEXT,
  owner_response_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reviews_biz ON reviews(business_id, status, created_at DESC);

CREATE TABLE claims (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  domain_match INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Paid Featured placement. scope: null city + null category = sitewide (home + search)
CREATE TABLE placements (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL,
  city_slug TEXT,
  category TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_place_active ON placements(ends_on, starts_on);

-- Display ads, always labeled Advertisement
CREATE TABLE ads (
  id INTEGER PRIMARY KEY,
  advertiser TEXT NOT NULL,
  slot TEXT NOT NULL,             -- home | city | category
  scope_slug TEXT,                -- city or category slug, null = every page of that slot
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  alt TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Web mentions found by research (news, Reddit threads, forums): link + our own summary
CREATE TABLE mentions (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  summary TEXT,
  published_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mentions_biz ON mentions(business_id, published_on DESC);

-- Inbound leads: advertise inquiries, new-business submissions, corrections
CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,             -- advertise | add-business | correction
  name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  payload TEXT,                   -- JSON
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cities (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  intro TEXT
);

CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows_read INTEGER DEFAULT 0,
  rows_kept INTEGER DEFAULT 0,
  note TEXT
);

-- Full-text search
CREATE VIRTUAL TABLE businesses_fts USING fts5(
  name, subtype, city, description, content='businesses', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER businesses_ai AFTER INSERT ON businesses BEGIN
  INSERT INTO businesses_fts(rowid, name, subtype, city, description) VALUES (new.id, new.name, new.subtype, new.city, new.description);
END;
CREATE TRIGGER businesses_ad AFTER DELETE ON businesses BEGIN
  INSERT INTO businesses_fts(businesses_fts, rowid, name, subtype, city, description) VALUES ('delete', old.id, old.name, old.subtype, old.city, old.description);
END;
CREATE TRIGGER businesses_au AFTER UPDATE OF name, subtype, city, description ON businesses BEGIN
  INSERT INTO businesses_fts(businesses_fts, rowid, name, subtype, city, description) VALUES ('delete', old.id, old.name, old.subtype, old.city, old.description);
  INSERT INTO businesses_fts(rowid, name, subtype, city, description) VALUES (new.id, new.name, new.subtype, new.city, new.description);
END;

INSERT INTO cities (slug, name) VALUES
 ('coconut-creek','Coconut Creek'),('cooper-city','Cooper City'),('coral-springs','Coral Springs'),('dania-beach','Dania Beach'),
 ('davie','Davie'),('deerfield-beach','Deerfield Beach'),('fort-lauderdale','Fort Lauderdale'),('hallandale-beach','Hallandale Beach'),
 ('hillsboro-beach','Hillsboro Beach'),('hollywood','Hollywood'),('lauderdale-by-the-sea','Lauderdale-By-The-Sea'),('lauderdale-lakes','Lauderdale Lakes'),
 ('lauderhill','Lauderhill'),('lazy-lake','Lazy Lake'),('lighthouse-point','Lighthouse Point'),('margate','Margate'),('miramar','Miramar'),
 ('north-lauderdale','North Lauderdale'),('oakland-park','Oakland Park'),('parkland','Parkland'),('pembroke-park','Pembroke Park'),
 ('pembroke-pines','Pembroke Pines'),('plantation','Plantation'),('pompano-beach','Pompano Beach'),('sea-ranch-lakes','Sea Ranch Lakes'),
 ('southwest-ranches','Southwest Ranches'),('sunrise','Sunrise'),('tamarac','Tamarac'),('west-park','West Park'),('weston','Weston'),
 ('wilton-manors','Wilton Manors');
