-- The product-restriction resolvers added in a recent security pass
-- (assertProductAllowedForCapRow, assertProductAllowedForCorrectiveAction,
-- resolveCapFindingOrg, resolveCapActionOrg -- see product-access-check.server.ts
-- and capability-api.functions.ts) run JOIN queries through these nine
-- foreign key columns on every write to the affected tables. None of them
-- had an index. At demo-data scale this is invisible; at real production
-- scale, every one of these (now frequently-hit) authorization checks
-- would degrade to a sequential scan as each table grows. Added before
-- this becomes a real problem rather than after.

CREATE INDEX IF NOT EXISTS idx_cap_actions_assessment_id
  ON public.cap_actions(assessment_id);

CREATE INDEX IF NOT EXISTS idx_cap_findings_assessment_id
  ON public.cap_findings(assessment_id);

CREATE INDEX IF NOT EXISTS idx_cap_performance_impacts_assessment_id
  ON public.cap_performance_impacts(assessment_id);

CREATE INDEX IF NOT EXISTS idx_cap_problems_assessment_id
  ON public.cap_problems(assessment_id);

CREATE INDEX IF NOT EXISTS idx_cap_root_gaps_assessment_id
  ON public.cap_root_gaps(assessment_id);

CREATE INDEX IF NOT EXISTS idx_cap_evidence_finding_id
  ON public.cap_evidence(finding_id);

CREATE INDEX IF NOT EXISTS idx_cap_results_action_id
  ON public.cap_results(action_id);

CREATE INDEX IF NOT EXISTS idx_cap_validations_action_id
  ON public.cap_validations(action_id);

CREATE INDEX IF NOT EXISTS idx_corrective_actions_finding_id
  ON public.corrective_actions(finding_id);
