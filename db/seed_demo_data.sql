-- =====================================================================
-- Demo data for live product demonstrations — NOT real client data.
--
-- Safe by construction, not just by convention:
--   - Every org name is prefixed "[DEMO]" so it's unmistakable in every
--     list/dropdown in the app, never confusable with a real client.
--   - Inserted directly via SQL, bypassing the application's server
--     functions entirely. This matters specifically for the Intelligence
--     Layer: pattern generation (intelligence-capture.server.ts) only
--     runs when a finding/action/project is closed THROUGH the app's own
--     code path, never from a raw database INSERT. A direct SQL seed
--     like this one cannot accidentally create intelligence_events or
--     intelligence_patterns rows, so there is no path by which this fake
--     data could leak into the shared cross-client pool other real
--     clients query through Ask IronIQ.
--   - Re-runnable safely: re-running this file will create a SECOND set
--     of demo orgs (no ON CONFLICT dedup) — if you only want one, drop
--     the existing "[DEMO]" orgs first (see the cleanup query at the
--     bottom of this file, commented out).
--
-- Covers: 3 organizations (different industries), each with one
-- facility, a realistic mix of findings/corrective actions/improvement
-- projects across every status (not everything freshly open, not
-- everything wrapped up) so the demo shows a believable, lived-in
-- product rather than empty screens or an implausibly perfect one.
--
-- Deliberately NOT seeded here (needs the real UI/live AI, not just
-- rows in a table, to actually be worth demoing): Bulk Intake documents,
-- CAD conversion jobs, Intelligence Layer patterns, Capability/Field
-- Assessments. For a live demo, those are more compelling done for real
-- in the moment ("watch it process this file live") than pre-canned.
-- =====================================================================

DO $$
DECLARE
  v_org_aero uuid;
  v_org_auto uuid;
  v_org_tool uuid;
  v_fac_aero uuid;
  v_fac_auto uuid;
  v_fac_tool uuid;
  v_finding uuid;
BEGIN

  -- ---------------------------------------------------------------
  -- Org 1: aerospace machine shop — mid-engagement, mixed progress
  -- ---------------------------------------------------------------
  INSERT INTO organizations (name, industry, headquarters, primary_contact_name, primary_contact_email)
  VALUES ('[DEMO] Meridian Aerostructures', 'aerospace', 'Wichita, KS', 'Dana Whitfield', 'dwhitfield@example.com')
  RETURNING id INTO v_org_aero;

  INSERT INTO facilities
    (organization_id, name, address, primary_products, primary_processes, machine_count, employee_count,
     operating_shifts, certifications, current_readiness_score, last_assessment_date)
  VALUES
    (v_org_aero, 'Plant 1 — Wichita', '4400 Airway Blvd, Wichita, KS', 'Structural brackets, wing rib assemblies',
     '5-axis CNC milling, precision grinding, NDT inspection', 34, 210, 2,
     ARRAY['AS9100D', 'NADCAP - Heat Treat'], 68.5, CURRENT_DATE - 21)
  RETURNING id INTO v_fac_aero;

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    business_impact, root_cause, recommended_action, assigned_owner, target_date, status)
  VALUES (v_org_aero, v_fac_aero, 'MER-F-001', 'Machine Connectivity', 'critical',
    'Three of four 5-axis mills on Line 2 have no networked data collection — cycle times and scrap are tracked on paper.',
    'No real-time visibility into Line 2 throughput; scrap trends only surface at month-end.',
    'Machines predate the plant''s MES rollout and were never retrofitted with connectivity hardware.',
    'Install edge gateways on the three unconnected mills and integrate with existing MES.',
    'J. Alvarez (Plant Engineering)', CURRENT_DATE + 30, 'in_progress')
  RETURNING id INTO v_finding;

  INSERT INTO corrective_actions (finding_id, facility_id, action_description, owner, target_date, status)
  VALUES (v_finding, v_fac_aero, 'Procure and install edge gateway hardware on Mill 7 (first of three).',
    'J. Alvarez', CURRENT_DATE + 10, 'in_progress');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    business_impact, status, target_date, assigned_owner)
  VALUES (v_org_aero, v_fac_aero, 'MER-F-002', 'Document Control', 'high',
    'Work instructions for the rib assembly cell are stored as uncontrolled local PDFs — no revision tracking.',
    'Risk of operators using superseded instructions after an engineering change.',
    'open', CURRENT_DATE + 45, 'M. Chen (Quality)');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    root_cause, recommended_action, status, closure_evidence, verified_by, verification_date, target_date, assigned_owner)
  VALUES (v_org_aero, v_fac_aero, 'MER-F-003', 'Preventive Maintenance', 'medium',
    'PM schedule for the precision grinders was being followed inconsistently during high-volume weeks.',
    'PM tasks were manually scheduled and got deprioritized against production pressure.',
    'Moved PM scheduling into the MES with hard scheduling blocks that cannot be overridden without sign-off.',
    'closed', 'PM compliance logs for the last 6 weeks show 100% on-schedule completion.',
    'R. Delgado', CURRENT_DATE - 5, CURRENT_DATE - 10, 'R. Delgado (Maintenance Lead)');

  INSERT INTO improvement_projects
    (organization_id, facility_id, name, owner, executive_sponsor, objective, baseline_metric, target_metric,
     estimated_financial_impact, planned_start, planned_completion, status, percent_complete, actions, results)
  VALUES
    (v_org_aero, v_fac_aero, 'Line 2 Connectivity & MES Integration', 'J. Alvarez', 'VP Operations',
     'Bring all Line 2 machines onto the MES for real-time OEE and scrap tracking.',
     '1 of 4 machines networked', '4 of 4 machines networked', 145000,
     CURRENT_DATE - 20, CURRENT_DATE + 40, 'in_progress', 35, 'Gateway installed on Mill 4; procurement underway for Mills 6/7/8.', NULL);

  INSERT INTO improvement_projects
    (organization_id, facility_id, name, owner, executive_sponsor, objective, baseline_metric, target_metric,
     estimated_financial_impact, planned_start, planned_completion, status, percent_complete, actions, results)
  VALUES
    (v_org_aero, v_fac_aero, 'PM Scheduling Hardening', 'R. Delgado', 'Plant Manager',
     'Eliminate PM schedule slippage during high-volume production weeks.',
     '72% on-schedule PM completion', '95%+ on-schedule PM completion', 22000,
     CURRENT_DATE - 60, CURRENT_DATE - 8, 'complete', 100,
     'Moved PM scheduling into MES with mandatory sign-off to override.',
     '100% on-schedule completion sustained over 6 weeks post-implementation.');

  -- ---------------------------------------------------------------
  -- Org 2: automotive tier-1 supplier — earlier in engagement, more open items
  -- ---------------------------------------------------------------
  INSERT INTO organizations (name, industry, headquarters, primary_contact_name, primary_contact_email)
  VALUES ('[DEMO] Ridgeline Powertrain Components', 'automotive', 'Toledo, OH', 'Marcus Yoon', 'myoon@example.com')
  RETURNING id INTO v_org_auto;

  INSERT INTO facilities
    (organization_id, name, address, primary_products, primary_processes, machine_count, employee_count,
     operating_shifts, certifications, current_readiness_score, last_assessment_date)
  VALUES
    (v_org_auto, 'Toledo Machining Center', '1200 Industrial Pkwy, Toledo, OH', 'Transmission housings, gear blanks',
     'CNC turning, broaching, induction hardening', 52, 340, 3,
     ARRAY['IATF 16949'], 54.0, CURRENT_DATE - 9)
  RETURNING id INTO v_fac_auto;

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    business_impact, status, target_date, assigned_owner)
  VALUES (v_org_auto, v_fac_auto, 'RDG-F-001', 'Tooling Management', 'critical',
    'No centralized tool life tracking across the broaching cells — tool changes are based on operator judgment.',
    'Inconsistent surface finish scrap rate (3.8% vs. 1.2% industry benchmark) traced to tool wear variability.',
    'open', CURRENT_DATE + 21, 'T. Brooks (Manufacturing Engineering)');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    business_impact, status, target_date, assigned_owner)
  VALUES (v_org_auto, v_fac_auto, 'RDG-F-002', 'Workforce Readiness', 'high',
    'Only 2 of 11 CNC setup technicians are cross-trained on the induction hardening line.',
    'Single point of failure risk on 3rd shift when either qualified technician is out.',
    'assigned', CURRENT_DATE + 60, 'HR / Training');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    status, target_date, assigned_owner)
  VALUES (v_org_auto, v_fac_auto, 'RDG-F-003', 'Machine Connectivity', 'medium',
    'Gear blank turning cells report OEE manually on whiteboards, transcribed to a spreadsheet once per shift.',
    'awaiting_verification', CURRENT_DATE + 5, 'T. Brooks');

  INSERT INTO corrective_actions (finding_id, facility_id, action_description, owner, target_date, status)
  SELECT id, v_fac_auto, 'Install tool-life sensors on the two highest-volume broaching cells as a pilot.',
    'T. Brooks', CURRENT_DATE + 14, 'open'
  FROM findings WHERE finding_code = 'RDG-F-001';

  INSERT INTO improvement_projects
    (organization_id, facility_id, name, owner, executive_sponsor, objective, baseline_metric, target_metric,
     estimated_financial_impact, planned_start, planned_completion, status, percent_complete, actions, results)
  VALUES
    (v_org_auto, v_fac_auto, 'Broaching Tool Life Management Pilot', 'T. Brooks', 'Plant Manager',
     'Reduce surface finish scrap through proactive tool-life tracking.',
     '3.8% scrap rate', '1.5% scrap rate', 68000,
     CURRENT_DATE + 7, CURRENT_DATE + 90, 'planned', 0, NULL, NULL);

  -- ---------------------------------------------------------------
  -- Org 3: small tool & die shop — early-stage engagement, mostly open
  -- ---------------------------------------------------------------
  INSERT INTO organizations (name, industry, headquarters, primary_contact_name, primary_contact_email)
  VALUES ('[DEMO] Blackstone Tool & Die', 'general manufacturing', 'Rockford, IL', 'Angela Petrov', 'apetrov@example.com')
  RETURNING id INTO v_org_tool;

  INSERT INTO facilities
    (organization_id, name, address, primary_products, primary_processes, machine_count, employee_count,
     operating_shifts, certifications, current_readiness_score, last_assessment_date)
  VALUES
    (v_org_tool, 'Rockford Shop', '88 Foundry Rd, Rockford, IL', 'Stamping dies, injection molds',
     'Wire EDM, surface grinding, manual toolmaking', 18, 45, 1,
     ARRAY[]::text[], 41.5, CURRENT_DATE - 3)
  RETURNING id INTO v_fac_tool;

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    business_impact, status, target_date, assigned_owner)
  VALUES (v_org_tool, v_fac_tool, 'BST-F-001', 'Quotation & Estimating', 'high',
    'Die design hours are estimated from the lead toolmaker''s memory of similar past jobs — no historical data used.',
    'Recent quotes have run 15-30% over estimated hours on complex progressive dies.',
    'open', CURRENT_DATE + 30, 'A. Petrov (Owner)');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    status, target_date, assigned_owner)
  VALUES (v_org_tool, v_fac_tool, 'BST-F-002', 'Preventive Maintenance', 'critical',
    'The shop''s only wire EDM has no documented PM schedule at all — maintenance is purely reactive.',
    'open', CURRENT_DATE + 14, 'A. Petrov');

  INSERT INTO findings (organization_id, facility_id, finding_code, category_name, severity, description,
    status, target_date, assigned_owner)
  VALUES (v_org_tool, v_fac_tool, 'BST-F-003', 'Document Control', 'opportunity',
    'Die maintenance history is tracked in a single shared notebook at the EDM station.',
    'open', NULL, NULL);

  RAISE NOTICE 'Demo data seeded: 3 organizations (aero=%, auto=%, tool=%), findings/actions/projects across a realistic mix of statuses.',
    v_org_aero, v_org_auto, v_org_tool;
END $$;

-- ---------------------------------------------------------------------
-- Cleanup: run this (uncommented) to remove ALL demo data cleanly before
-- re-seeding, or before a real client onboarding if you want a clean
-- slate. ON DELETE CASCADE on facilities/findings/etc. means deleting
-- the organizations is sufficient — nothing needs deleting in any
-- particular order.
-- ---------------------------------------------------------------------
-- DELETE FROM public.organizations WHERE name LIKE '[DEMO]%';

-- =====================================================================
-- Expansion: CAD jobs, CNC change log entries, and Capability/Field
-- assessments — added after direct feedback that the demo needed to
-- look genuinely "lived in" across ALL THREE products, not just
-- Assessment. Looks up the three orgs seeded above by name rather than
-- redeclaring them, so this can be run as its own follow-up against a
-- database that already has the block above applied.
--
-- Still safe by the same construction as the rest of this file: direct
-- SQL, no server functions touched, so nothing here can trigger
-- Intelligence Layer pattern generation. CAD jobs use a placeholder
-- storage_path with no real object behind it in S3 — the metadata and
-- extracted fields display correctly in the UI, but the original file
-- itself isn't actually downloadable. Worth knowing before a demo where
-- someone might click "view original."
-- =====================================================================

DO $$
DECLARE
  v_org_aero uuid;
  v_org_auto uuid;
  v_org_tool uuid;
  v_fac_aero uuid;
  v_fac_auto uuid;
  v_fac_tool uuid;
  v_cad_job uuid;
  v_cap_assessment uuid;
  v_field_assessment uuid;
BEGIN
  SELECT id INTO v_org_aero FROM organizations WHERE name = '[DEMO] Meridian Aerostructures';
  SELECT id INTO v_org_auto FROM organizations WHERE name = '[DEMO] Ridgeline Powertrain Components';
  SELECT id INTO v_org_tool FROM organizations WHERE name = '[DEMO] Blackstone Tool & Die';
  IF v_org_aero IS NULL THEN
    RAISE EXCEPTION 'Demo organizations not found — run the seed block above this one first.';
  END IF;

  SELECT id INTO v_fac_aero FROM facilities WHERE organization_id = v_org_aero LIMIT 1;
  SELECT id INTO v_fac_auto FROM facilities WHERE organization_id = v_org_auto LIMIT 1;
  SELECT id INTO v_fac_tool FROM facilities WHERE organization_id = v_org_tool LIMIT 1;

  -- ---------------------------------------------------------------
  -- CAD Conversion: 2 jobs for the aerospace org — one fully reviewed,
  -- one still sitting at extracted (awaiting review), so the page
  -- shows a real mix rather than everything perfectly finished.
  -- ---------------------------------------------------------------
  INSERT INTO cad_jobs
    (organization_id, facility_id, original_filename, mime_type, byte_size, storage_path, source_type, status)
  VALUES
    (v_org_aero, v_fac_aero, 'bracket-assembly-rev-c.jpg', 'image/jpeg', 2400000,
     v_org_aero::text || '/demo-placeholder-1.jpg', 'raster', 'reviewed')
  RETURNING id INTO v_cad_job;

  INSERT INTO cad_extracted_fields (job_id, field_type, field_name, field_value, location_hint, confidence, status)
  VALUES
    (v_cad_job, 'title_block', 'Part Number', 'MER-BRK-1042-C', 'title block, bottom-right', 'high', 'accepted'),
    (v_cad_job, 'title_block', 'Revision', 'C', 'title block, bottom-right', 'high', 'accepted'),
    (v_cad_job, 'dimension', 'Overall length', '184.5 mm ± 0.2', 'primary view, left edge', 'high', 'accepted'),
    (v_cad_job, 'tolerance', 'Mounting hole diameter', '8.00 +0.02/-0.00 mm', 'diameter callout, upper-left', 'moderate', 'accepted'),
    (v_cad_job, 'material', 'Material', '7075-T6 aluminum', 'notes block', 'high', 'accepted');

  INSERT INTO cad_jobs
    (organization_id, facility_id, original_filename, mime_type, byte_size, storage_path, source_type, status)
  VALUES
    (v_org_aero, v_fac_aero, 'wing-rib-fitting.jpg', 'image/jpeg', 1800000,
     v_org_aero::text || '/demo-placeholder-2.jpg', 'raster', 'extracted')
  RETURNING id INTO v_cad_job;

  INSERT INTO cad_extracted_fields (job_id, field_type, field_name, field_value, location_hint, confidence, status)
  VALUES
    (v_cad_job, 'title_block', 'Part Number', 'MER-RIB-2201', 'title block, bottom-right', 'high', 'suggested'),
    (v_cad_job, 'dimension', 'Rib thickness', '4.75 mm', 'section view', 'moderate', 'suggested'),
    (v_cad_job, 'note', 'General note', 'Break all sharp edges 0.5mm max', 'notes block', 'moderate', 'suggested');

  -- ---------------------------------------------------------------
  -- CNC Coding: 3 entries for the automotive org (machining-heavy
  -- context fits well) — one verified with a real measured outcome and
  -- sharing enabled, one verified without sharing, one still just
  -- logged (not yet verified).
  -- ---------------------------------------------------------------
  INSERT INTO cnc_change_log
    (organization_id, facility_id, machine_name, program_identifier, change_category,
     change_description, reason, outcome_description, status, contribute_consent, verified_at)
  VALUES
    (v_org_auto, v_fac_auto, 'Okuma LB3000 #2', 'PRG-4471', 'feed_speed',
     'Reduced feed rate 12% on finish pass, added a dwell at the tool retract point',
     'Chatter marks on the transmission housing bore finish, intermittent across the shift',
     'Chatter eliminated on all parts run since; surface finish now consistently within spec.',
     'verified', true, now() - interval '4 days');

  INSERT INTO cnc_change_log
    (organization_id, facility_id, machine_name, program_identifier, change_category,
     change_description, reason, outcome_description, status, contribute_consent, verified_at)
  VALUES
    (v_org_auto, v_fac_auto, 'Mazak QT-250', 'PRG-2209', 'tooling',
     'Switched to a coated carbide insert rated for higher heat, same geometry',
     'Excessive tool wear on gear blank turning — inserts lasting under 40 parts',
     'Insert life roughly doubled to ~85 parts before replacement needed.',
     'verified', false, now() - interval '11 days');

  INSERT INTO cnc_change_log
    (organization_id, facility_id, machine_name, program_identifier, change_category, change_description, reason, status)
  VALUES
    (v_org_auto, v_fac_auto, 'Haas VF-2 #1', 'PRG-3315', 'toolpath',
     'Adjusted lead-in/lead-out on the finish contour to a tangential arc instead of a straight plunge',
     'Witness marks visible at the toolpath entry point on the housing face',
     'logged');

  -- ---------------------------------------------------------------
  -- Capability Assessment: one finalized assessment for the tool & die
  -- org, with a couple of documented problems — gives the Assessment
  -- Hub's live status card something real to show for this type too.
  -- ---------------------------------------------------------------
  INSERT INTO cap_assessments (organization_id, facility_id, name, lead_assessor, scope, status, overall_score)
  VALUES (v_org_tool, v_fac_tool, 'Rockford Shop — Q3 Capability Review', 'D. Whitfield',
          'Die design and toolmaking capability', 'finalized', 52.5)
  RETURNING id INTO v_cap_assessment;

  INSERT INTO cap_problems
    (assessment_id, stated_problem, location_process, performance_impact, previous_actions, desired_outcome)
  VALUES
    (v_cap_assessment,
     'Die design hours are estimated from memory of past jobs rather than tracked historical data',
     'Quoting and die design planning',
     'Recent complex progressive die quotes ran 15-30% over estimated hours',
     'None — informal tribal knowledge only',
     'A simple historical-hours log the lead toolmaker can reference when quoting similar jobs');

  -- ---------------------------------------------------------------
  -- Field Assessment: one in-progress walkthrough for the aerospace
  -- org, with a documented gap.
  -- ---------------------------------------------------------------
  INSERT INTO field_assessments (organization_id, facility_id, area, work_center, observer_name, assessment_status)
  VALUES (v_org_aero, v_fac_aero, 'Line 2 — CNC Milling', 'Mill 6/7/8 cell', 'J. Alvarez', 'in_progress')
  RETURNING id INTO v_field_assessment;

  INSERT INTO field_gaps
    (field_assessment_id, gap_number, location, observed_condition, objective_evidence, missing_capability, severity)
  VALUES
    (v_field_assessment, 1, 'Mill 7 control panel',
     'No networked data collection — operator logs cycle counts on a paper sheet taped to the machine',
     'Photo taken of the paper log sheet, cross-checked against the MES showing zero data for this machine',
     'Real-time OEE and scrap tracking for this machine', 'high');

  RAISE NOTICE 'Demo data expansion complete: CAD jobs, CNC log entries, capability assessment, field assessment.';
END $$;

-- =====================================================================
-- Expansion 2: real Template Assessment runs, responses, readiness
-- history, and Capability Assessment findings — direct feedback that
-- "there are no assessments" and the facilities section reads as hollow
-- without real historical trend data behind the scores already shown.
--
-- Same safety construction as every block above: direct SQL, no server
-- functions touched.
-- =====================================================================

DO $$
DECLARE
  v_org_aero uuid;
  v_org_auto uuid;
  v_org_tool uuid;
  v_fac_aero uuid;
  v_fac_auto uuid;
  v_fac_tool uuid;
  v_cap_assessment uuid;
  v_template uuid;
  v_version uuid;
  v_cat_connectivity uuid;
  v_cat_quality uuid;
  v_cat_workforce uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_q4 uuid; v_q5 uuid; v_q6 uuid;
  v_assessment uuid;
BEGIN
  SELECT id INTO v_org_aero FROM organizations WHERE name = '[DEMO] Meridian Aerostructures';
  SELECT id INTO v_org_auto FROM organizations WHERE name = '[DEMO] Ridgeline Powertrain Components';
  SELECT id INTO v_org_tool FROM organizations WHERE name = '[DEMO] Blackstone Tool & Die';
  IF v_org_aero IS NULL THEN
    RAISE EXCEPTION 'Demo organizations not found — run the seed blocks above this one first.';
  END IF;

  SELECT id INTO v_fac_aero FROM facilities WHERE organization_id = v_org_aero LIMIT 1;
  SELECT id INTO v_fac_auto FROM facilities WHERE organization_id = v_org_auto LIMIT 1;
  SELECT id INTO v_fac_tool FROM facilities WHERE organization_id = v_org_tool LIMIT 1;
  SELECT id INTO v_cap_assessment FROM cap_assessments WHERE facility_id = v_fac_tool LIMIT 1;

  -- ---------------------------------------------------------------
  -- One shared, published template — assessment_templates isn't
  -- org-scoped in this schema, so every demo org's assessments use the
  -- same real template rather than needing three duplicates.
  -- ---------------------------------------------------------------
  INSERT INTO assessment_templates (name, description, status)
  VALUES ('[DEMO] IronIQ Standard Readiness Assessment', 'Baseline readiness scorecard used across demo engagements.', 'draft')
  RETURNING id INTO v_template;

  INSERT INTO assessment_template_versions (template_id, version, status)
  VALUES (v_template, 1, 'draft')
  RETURNING id INTO v_version;

  INSERT INTO assessment_categories (template_version_id, code, name, weight, sort_order)
  VALUES (v_version, 'CONN', 'Machine Connectivity', 30, 1) RETURNING id INTO v_cat_connectivity;
  INSERT INTO assessment_categories (template_version_id, code, name, weight, sort_order)
  VALUES (v_version, 'QUAL', 'Quality Systems', 40, 2) RETURNING id INTO v_cat_quality;
  INSERT INTO assessment_categories (template_version_id, code, name, weight, sort_order)
  VALUES (v_version, 'WORK', 'Workforce Readiness', 30, 3) RETURNING id INTO v_cat_workforce;

  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, is_critical, sort_order)
  VALUES (v_cat_connectivity, 'CONN-1', 'Are all production machines networked for real-time data collection?', 2, true, 1) RETURNING id INTO v_q1;
  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, sort_order)
  VALUES (v_cat_connectivity, 'CONN-2', 'Is OEE tracked automatically rather than manually transcribed?', 1, 2) RETURNING id INTO v_q2;
  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, is_critical, sort_order)
  VALUES (v_cat_quality, 'QUAL-1', 'Are work instructions under formal revision control?', 2, true, 1) RETURNING id INTO v_q3;
  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, sort_order)
  VALUES (v_cat_quality, 'QUAL-2', 'Is a preventive maintenance schedule documented and followed?', 1, 2) RETURNING id INTO v_q4;
  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, sort_order)
  VALUES (v_cat_workforce, 'WORK-1', 'Are critical operations cross-trained across at least 2 people per shift?', 1, 1) RETURNING id INTO v_q5;
  INSERT INTO assessment_questions (category_id, question_code, question_text, weight, sort_order)
  VALUES (v_cat_workforce, 'WORK-2', 'Is die/tooling design estimating based on tracked historical data?', 1, 2) RETURNING id INTO v_q6;

  -- Publish only after all categories/questions exist — the version's
  -- own trigger blocks any further content changes once published, so
  -- this order is required, not just tidier.
  UPDATE assessment_template_versions
     SET status = 'published', published_at = now() - interval '90 days'
   WHERE id = v_version;
  UPDATE assessment_templates SET status = 'published' WHERE id = v_template;

  -- ---------------------------------------------------------------
  -- Meridian (aerospace, mid-engagement): one finalized assessment with
  -- real scored responses matching the facility's existing 68.5 score
  -- and the finding/project narrative already seeded above.
  -- ---------------------------------------------------------------
  INSERT INTO assessments
    (organization_id, facility_id, template_version_id, name, assessment_date, lead_assessor, scope,
     status, overall_score, confidence_score, completion_pct, readiness_level)
  VALUES
    (v_org_aero, v_fac_aero, v_version, 'Q2 2026 Readiness Assessment', CURRENT_DATE - 15, 'J. Alvarez',
     'Plant 1 — Wichita, full facility', 'in_progress', 68.5, 80.0, 100.0, 'developing')
  RETURNING id INTO v_assessment;

  INSERT INTO assessment_responses (assessment_id, question_id, score, comments, answered_at)
  VALUES
    (v_assessment, v_q1, 2, 'Mill 4 networked; Mills 6/7/8 still manual — see MER-F-001.', now() - interval '15 days'),
    (v_assessment, v_q2, 2, 'Partial OEE via MES on connected machines only.', now() - interval '15 days'),
    (v_assessment, v_q3, 4, 'Work instructions now under MES revision control post-remediation.', now() - interval '15 days'),
    (v_assessment, v_q4, 5, 'PM scheduling hardened this quarter — 100% on-schedule sustained.', now() - interval '15 days'),
    (v_assessment, v_q5, 3, 'Reasonable cross-training on primary lines.', now() - interval '15 days'),
    (v_assessment, v_q6, 3, 'Not directly applicable to this facility.', now() - interval '15 days');

  -- Finalize only after responses exist — this table has the same
  -- editable-only-before-finalized protection the template versions did.
  UPDATE assessments SET status = 'finalized', finalized_at = now() - interval '15 days' WHERE id = v_assessment;

  -- ---------------------------------------------------------------
  -- Ridgeline (automotive, earlier in engagement): in-progress
  -- assessment, no responses yet — a real partially-done state, not
  -- everything either finished or not started.
  -- ---------------------------------------------------------------
  INSERT INTO assessments
    (organization_id, facility_id, template_version_id, name, assessment_date, lead_assessor, scope, status, completion_pct)
  VALUES
    (v_org_auto, v_fac_auto, v_version, 'Initial Readiness Assessment', CURRENT_DATE - 4, 'T. Brooks',
     'Toledo Machining Center', 'in_progress', 33.0);

  -- ---------------------------------------------------------------
  -- Blackstone (tool & die, earliest stage): draft, not yet started in
  -- earnest — matches the "mostly open findings, nothing wrapped up" story.
  -- ---------------------------------------------------------------
  INSERT INTO assessments
    (organization_id, facility_id, template_version_id, name, assessment_date, lead_assessor, scope, status, completion_pct)
  VALUES
    (v_org_tool, v_fac_tool, v_version, 'Initial Readiness Assessment', CURRENT_DATE - 1, 'A. Petrov',
     'Rockford Shop', 'draft', 0.0);

  -- ---------------------------------------------------------------
  -- Readiness history: 3 periods per facility, trending consistent with
  -- the scores/narrative already established, so the Dashboard's trend
  -- chart and the facilities' "current score" both have real history
  -- behind them instead of a lone snapshot.
  -- ---------------------------------------------------------------
  INSERT INTO readiness_history (facility_id, period_label, recorded_on, overall_score, confidence_score) VALUES
    (v_fac_aero, 'Q4 2025', CURRENT_DATE - 195, 48.0, 60.0),
    (v_fac_aero, 'Q1 2026', CURRENT_DATE - 105, 54.0, 70.0),
    (v_fac_aero, 'Q2 2026', CURRENT_DATE - 15, 68.5, 80.0);

  INSERT INTO readiness_history (facility_id, period_label, recorded_on, overall_score, confidence_score) VALUES
    (v_fac_auto, 'Q1 2026', CURRENT_DATE - 100, 46.0, 55.0),
    (v_fac_auto, 'Q2 2026', CURRENT_DATE - 9, 54.0, 62.0);

  INSERT INTO readiness_history (facility_id, period_label, recorded_on, overall_score, confidence_score) VALUES
    (v_fac_tool, 'Q2 2026', CURRENT_DATE - 3, 41.5, 50.0);

  -- ---------------------------------------------------------------
  -- cap_findings for Blackstone's capability assessment — the specific
  -- table diagnosed as genuinely empty (not broken) after checking the
  -- real code: a fully-built 545-line Add/Edit/Approve/Delete system
  -- with zero demo data ever seeded into it.
  -- ---------------------------------------------------------------
  IF v_cap_assessment IS NOT NULL THEN
    INSERT INTO cap_findings
      (assessment_id, title, finding_text, classification, severity, confidence, source, approved)
    VALUES
      (v_cap_assessment, 'No historical basis for die design hour estimates',
       'Die design hours are estimated from the lead toolmaker''s memory of similar past jobs rather than any tracked historical data, leading to systematic underestimation on complex progressive dies.',
       'risk', 'high', 'high', 'ironclad_validated', true),
      (v_cap_assessment, 'Wire EDM has no documented PM schedule',
       'The shop''s only wire EDM machine is maintained reactively with no documented preventive maintenance schedule, creating single-point-of-failure risk for the shop''s only EDM capability.',
       'risk', 'critical', 'moderate', 'ironclad_validated', false);
  END IF;

  RAISE NOTICE 'Demo data expansion 2 complete: template assessments (finalized/in_progress/draft), responses, readiness history, cap_findings.';
END $$;

-- =====================================================================
-- Haas UMC-750 shop-floor asset for edge ingest demos. Only if a demo
-- facility already exists — do not invent a real customer org.
-- capture_path on posted events is mtconnect; protocol here matches that
-- without enabling poll-from-app (no MTConnect agent URL).
-- =====================================================================

DO $$
DECLARE
  v_org uuid;
  v_fac uuid;
BEGIN
  SELECT f.organization_id, f.id
    INTO v_org, v_fac
    FROM public.facilities f
    JOIN public.organizations o ON o.id = f.organization_id
   WHERE o.name LIKE '[DEMO]%'
   ORDER BY f.created_at
   LIMIT 1;

  IF v_org IS NULL OR v_fac IS NULL THEN
    RAISE NOTICE 'No demo facility found — skipping Haas UMC-750 shop machine seed.';
    RETURN;
  END IF;

  INSERT INTO public.shop_machines (
    organization_id, facility_id, asset_id, name, make, model, control, protocol
  )
  SELECT v_org, v_fac, 'MC-UMC750-01', 'Haas UMC-750', 'Haas', 'UMC-750', 'haas', 'mtconnect'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.shop_machines WHERE asset_id = 'MC-UMC750-01'
   );

  RAISE NOTICE 'Demo shop machine MC-UMC750-01 (Haas UMC-750) seeded for facility %.', v_fac;
END $$;
