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
