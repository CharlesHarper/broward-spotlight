-- Paid orders from Stripe Checkout: Featured placements, Spotlight articles and display ads.
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,              -- private link for the buyer: /order/<token>
  kind TEXT NOT NULL,                      -- featured | spotlight | ad
  business_id INTEGER,
  business_name TEXT NOT NULL,
  name TEXT,
  email TEXT,
  city_slug TEXT,
  category TEXT,
  ad_slot TEXT,                            -- home | city | category (ads only)
  ad_scope TEXT,
  link_url TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | canceled
  paid_through TEXT,                       -- last day covered (monthly plans)
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  placement_id INTEGER,
  ad_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX idx_orders_sub ON orders(stripe_subscription_id);
CREATE INDEX idx_orders_business ON orders(business_id, status);
