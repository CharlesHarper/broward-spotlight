-- Owner-uploaded photos. Details and the image itself are kept in separate tables so listing pages never load image data.
CREATE TABLE photos (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,                 -- random; used in the public address /photo/<key>.jpg
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'live',      -- live | removed (removed by an admin)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_business ON photos(business_id, status, id);
CREATE TABLE photo_data (
  photo_id INTEGER PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
  data BLOB NOT NULL
);
