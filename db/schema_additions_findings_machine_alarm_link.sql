-- Lets a Finding be created directly from a real IronIQ Edge alarm
-- event, not just from an assessment. Edge already ingests alarm events
-- (shop_machine_events.event_type = 'alarm') but nothing downstream
-- surfaced them as a quality/risk signal before this -- they just sat in
-- the events table, visible only if someone happened to query for them.
--
-- source_machine_event_id tracks which alarm (if any) a finding came
-- from, specifically so the "alarms not yet reviewed" list can exclude
-- ones already turned into a finding, without needing a separate
-- dedup/tracking table. Deliberately NOT automatic -- every real finding
-- still requires a person to decide it's worth tracking (see
-- machine-alarm-findings.functions.ts's own comment for why), this
-- column just lets that decision be remembered.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS source_machine_event_id UUID
    REFERENCES public.shop_machine_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_findings_source_machine_event
  ON public.findings(source_machine_event_id)
  WHERE source_machine_event_id IS NOT NULL;
