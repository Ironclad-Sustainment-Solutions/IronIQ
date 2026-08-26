-- Curated reference-library patterns: genuine, commonly-known industry
-- patterns Ironclad staff can vouch for as reasonable starting points,
-- not derived from any specific customer engagement (source_event_id is
-- NULL for all of these -- there's no real event to point to).
--
-- Inserted with embedding = NULL. These are NOT searchable via the
-- cosine-similarity retrieval in precedent-draft.functions.ts /
-- ask-ironiq.functions.ts until embeddings are backfilled -- see
-- scripts/backfill-pattern-embeddings.mjs, which requires a real
-- OPENAI_API_KEY this sandbox doesn't have and can't reach
-- (api.openai.com isn't in this environment's network allowlist).
-- Written and reviewed for content quality now; run the backfill script
-- once deployed somewhere with real credentials to make these live.
--
-- status = 'approved' directly (skipping pending_review) since these are
-- pre-vetted reference content, not something captured automatically
-- from a live finding that needs a human reviewer to sign off on.

INSERT INTO public.intelligence_patterns
  (product, category_label, pattern_summary, pattern_resolution, pattern_outcome, origin, status)
VALUES
  -- ---- assessment ----
  ('assessment', 'Discrete Manufacturing',
   'First-article inspection (FAI) reports exist but aren''t consistently tied to the specific revision of the drawing they were run against, making it unclear whether a later drawing change invalidated a prior FAI.',
   'Add a drawing revision field directly to the FAI record (not just the part number), and require a new FAI whenever the revision changes on any characteristic the FAI covers -- not just on any drawing change.',
   'Removed ambiguity about which FAIs are still valid after a drawing revision, reducing the chance of shipping parts inspected against an outdated print.',
   'reference_library', 'approved'),

  ('assessment', 'Discrete Manufacturing',
   'Process knowledge for adjusting a specific machine or fixture lives with one or two experienced operators and isn''t written into the work instruction -- new or substitute operators produce inconsistent results on the same job.',
   'Capture the undocumented adjustment steps directly in the work instruction or a job-specific setup sheet, written by interviewing the operator who currently knows it, before that knowledge is lost to turnover.',
   'Reduced first-shift-of-the-week scrap rate by making setup repeatable regardless of which operator runs the job.',
   'reference_library', 'approved'),

  ('assessment', 'Discrete Manufacturing',
   'Preventive maintenance is scheduled in a system but completion isn''t verified against the schedule -- PMs are frequently skipped or delayed with no escalation.',
   'Add a simple exception report: any PM more than a defined grace period overdue gets flagged to a supervisor automatically, rather than relying on someone remembering to check the schedule.',
   'Cut unplanned downtime from deferred maintenance by making overdue PMs visible before they caused a failure.',
   'reference_library', 'approved'),

  ('assessment', 'Discrete Manufacturing',
   'Operator training records show a class or sign-off was completed, but don''t tie that training to which specific machines or programs the operator is actually qualified to run unsupervised.',
   'Replace the generic training record with a qualification matrix: operator × machine/program, each cell showing qualified/not-qualified and the date, so supervisors can check at a glance who''s allowed to run what.',
   'Made it possible to catch an unqualified operator being assigned to a job before it happened, not after a nonconformance.',
   'reference_library', 'approved'),

  -- ---- cad ----
  ('cad', 'Discrete Manufacturing',
   'GD&T callouts for the same feature differ between two revisions of a drawing with no note in the revision block explaining why the tolerance changed.',
   'Require every GD&T change to be called out explicitly in the revision history (not just "updated tolerances"), so downstream reviewers can tell whether a looser tolerance was an intentional engineering decision or a drafting error.',
   'Caught a case where a tightened tolerance had been silently loosened between revisions, which would have let out-of-spec parts pass inspection.',
   'reference_library', 'approved'),

  ('cad', 'Discrete Manufacturing',
   'Drawings feeding parts with a material certification requirement don''t consistently call out which specific certification standard applies, leaving it to whoever processes the order to guess or ask.',
   'Add a standard title-block or notes-field entry for material certification requirements on every drawing where it applies, pulled from the same source of truth as the routing/traveler rather than re-entered by hand each time.',
   'Eliminated a recurring back-and-forth between quality and engineering to confirm which cert a given part actually needed.',
   'reference_library', 'approved'),

  ('cad', 'Discrete Manufacturing',
   'Critical dimensions (the few that actually drive fit, form, or function) aren''t visually distinguished from reference dimensions on the drawing, so inspectors sometimes measure the wrong ones as a priority under time pressure.',
   'Flag critical dimensions with a distinct symbol or callout convention, agreed with quality, so the drawing itself makes clear which measurements can''t be skipped even when inspection time is tight.',
   'Reduced inspection time on non-critical dimensions while improving catch rate on the ones that actually matter.',
   'reference_library', 'approved'),

  -- ---- cnc ----
  ('cnc', 'Discrete Manufacturing',
   'Tool offset changes are logged with the new value but not the reason for the change, making it hard to tell later whether an offset was corrected for tool wear, a setup error, or something that should have triggered a broader investigation.',
   'Require a reason code (or short free-text reason) on every offset change, not just the new number -- even a brief "tool wear, normal" versus "chip in first part, re-zeroed" changes what a reviewer does with that log entry later.',
   'Made it possible to spot a pattern of frequent "setup error" offset corrections on one machine that turned out to be a fixture problem, not operator error.',
   'reference_library', 'approved'),

  ('cnc', 'Discrete Manufacturing',
   'A program is edited directly on the machine control to solve an immediate problem, but the master/released version of the program in the file system is never updated to match -- the next setup pulls the old, unfixed version.',
   'Treat any on-machine edit as provisional: require it to be transcribed back into the released program (with a change-log entry) before the job is considered done, not just before the next shift.',
   'Stopped a recurring issue where a fix made on second shift was silently lost when first shift pulled the next day''s job from the released program library.',
   'reference_library', 'approved'),

  ('cnc', 'Discrete Manufacturing',
   'A fixture is modified on the floor (a clamp relocated, a stop added) to solve a part-holding problem, with no documentation tying that change back to an engineering change order or even a simple note of what changed and why.',
   'Require any fixture modification, however small, to be logged with what changed and why -- even an informal log is enough to prevent someone else from "fixing" it back to the original configuration and reintroducing the original problem.',
   'Prevented a repeat part-holding failure that had already been solved once, then undone by someone unaware of the earlier fix.',
   'reference_library', 'approved'),

  ('cnc', 'Discrete Manufacturing',
   'A post-processor or control software update is applied to a machine without re-running first-article verification on programs that were already qualified, on the assumption that the update "shouldn''t affect" existing programs.',
   'Treat any post-processor or control software update as a trigger for re-verifying first articles on at least a representative sample of active programs, rather than assuming compatibility.',
   'Caught a subtle feed-rate calculation change introduced by a control update before it affected a production run, not after.',
   'reference_library', 'approved');
