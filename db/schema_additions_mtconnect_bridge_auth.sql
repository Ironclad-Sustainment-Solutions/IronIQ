-- Push-based ingestion for the MTConnect bridge agent. Supersedes the
-- cloud-pull model in schema_additions_mtconnect_connector.sql: that
-- design had the cloud server fetch directly from mtconnect_agent_url,
-- which only works if Render can reach a private LAN address on the
-- customer's network -- it can't, for any real deployment (that address
-- sits behind the customer's firewall/NAT, and exposing shop-floor
-- control equipment directly to the public internet is a security
-- anti-pattern no plant should accept).
--
-- The standard fix, used by every real IIoT/shop-floor monitoring
-- product: a small on-prem bridge agent polls the LOCAL MTConnect agent
-- (same LAN, no firewall issue) and pushes readings OUTBOUND to this
-- cloud API over HTTPS -- outbound traffic like this is essentially
-- always allowed through any corporate firewall. The bridge
-- authenticates with a per-machine API key, not a browser session.

ALTER TABLE public.shop_machines
  -- SHA-256 hash of the bridge API key -- never store the plaintext key
  -- itself. A high-entropy random token doesn't need slow/salted hashing
  -- (bcrypt's purpose is defeating brute-force against low-entropy human
  -- passwords); a fast cryptographic hash is standard practice for API
  -- keys, matching how GitHub/Stripe-style tokens are typically stored.
  ADD COLUMN IF NOT EXISTS bridge_api_key_hash TEXT,
  -- Last 4 characters of the plaintext key, shown in the UI so a user
  -- can distinguish which key is active without ever seeing the whole
  -- thing again after generation -- same pattern as GitHub/Stripe.
  ADD COLUMN IF NOT EXISTS bridge_api_key_hint TEXT,
  ADD COLUMN IF NOT EXISTS bridge_api_key_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shop_machines_bridge_api_key_hash
  ON public.shop_machines(bridge_api_key_hash)
  WHERE bridge_api_key_hash IS NOT NULL;
