-- Fixes a real security gap in the IronIQ Edge machine-event ingestion
-- pipeline (schema_additions_machine_events.sql): the original design
-- authenticated every edge device with ONE global secret
-- (IRONIQ_EDGE_INGEST_SECRET) and looked up the target machine with
-- `SELECT ... FROM shop_machines WHERE asset_id = $1` -- no
-- organization/facility scoping at all. With a single shared secret and
-- an unscoped machine lookup, anyone holding that one secret could push
-- fabricated events for ANY customer's machine on the entire platform,
-- not just their own, just by knowing (or guessing) an asset_id. That's
-- a reasonable simplification for a single-customer pilot, but not safe
-- once a second machine shop starts using the same ingestion endpoint.
--
-- Fixed at the facility level, not per-machine: a real edge deployment
-- is one box sitting at one customer plant, reporting on potentially
-- many machines at that plant in a single batched request (the ingest
-- spec already supports up to 100 events per POST) -- per-machine
-- credentials would fight that design, while per-facility credentials
-- match it directly. This also matches "plant_id" already being a
-- per-event field in the ingest payload; a plant's edge box now proves
-- it IS that plant via a credential scoped to the matching facility,
-- rather than plant_id being a free-text label anyone with the (former)
-- global secret could put whatever they wanted into.

ALTER TABLE public.facilities
  -- SHA-256 hash of the edge ingest key -- never store the plaintext.
  -- Same reasoning as the rest of this codebase's API-key handling: a
  -- high-entropy random token doesn't need slow/salted hashing the way
  -- a human password does; a fast cryptographic hash is standard
  -- practice for API keys (GitHub/Stripe-style).
  ADD COLUMN IF NOT EXISTS edge_ingest_key_hash TEXT,
  -- Last 4 characters of the plaintext key, shown in the UI so a user
  -- can confirm which key is active without ever seeing the whole thing
  -- again after generation.
  ADD COLUMN IF NOT EXISTS edge_ingest_key_hint TEXT,
  ADD COLUMN IF NOT EXISTS edge_ingest_key_created_at TIMESTAMPTZ;

-- Indexed lookup by hash (not a loop-and-compare over every facility) --
-- the ingest handler computes SHA-256 of the bearer token it received
-- and looks up the one facility whose stored hash matches, an O(1)
-- indexed exact-match rather than an O(n) scan. A SHA-256 comparison via
-- indexed equality doesn't leak meaningfully more through timing than a
-- constant-time compare would for this purpose (unlike naive byte-by-byte
-- secret comparison, which is the actual, different concern
-- constant-time compares address).
CREATE UNIQUE INDEX IF NOT EXISTS idx_facilities_edge_ingest_key_hash
  ON public.facilities(edge_ingest_key_hash)
  WHERE edge_ingest_key_hash IS NOT NULL;
