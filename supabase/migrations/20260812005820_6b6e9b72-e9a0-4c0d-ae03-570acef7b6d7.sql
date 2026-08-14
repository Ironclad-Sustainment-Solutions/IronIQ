-- 1. Assessment setup fields (additive, nullable)
ALTER TABLE public.field_assessments
  ADD COLUMN IF NOT EXISTS assessment_name text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS primary_operational_question text,
  ADD COLUMN IF NOT EXISTS assessment_lead text,
  ADD COLUMN IF NOT EXISTS team_members text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS target_completion_date date,
  ADD COLUMN IF NOT EXISTS est_impact_notes text,
  ADD COLUMN IF NOT EXISTS est_lost_hours_week numeric,
  ADD COLUMN IF NOT EXISTS known_machines text,
  ADD COLUMN IF NOT EXISTS known_parts text,
  ADD COLUMN IF NOT EXISTS known_smes text,
  ADD COLUMN IF NOT EXISTS day_focus text;

-- 2. Implementation opportunity fields (additive, nullable)
ALTER TABLE public.field_opportunities
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS problem text,
  ADD COLUMN IF NOT EXISTS capability_gap text,
  ADD COLUMN IF NOT EXISTS domain_code text,
  ADD COLUMN IF NOT EXISTS affected_machines text,
  ADD COLUMN IF NOT EXISTS affected_parts text,
  ADD COLUMN IF NOT EXISTS expected_impact text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS complexity text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'Identified',
  ADD COLUMN IF NOT EXISTS is_pilot_candidate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gap_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3. Production events
CREATE TABLE IF NOT EXISTS public.field_production_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'Changeover',
  machine text,
  part text,
  operator text,
  shift text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  fixture text,
  program text,
  tooling_package text,
  material text,
  work_order text,
  previous_job text,
  incoming_job text,
  notes text,
  timer_started_at timestamptz,
  troubleshooting_started_at timestamptz,
  troubleshooting_resolution text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_production_events TO authenticated;
GRANT ALL ON public.field_production_events TO service_role;
ALTER TABLE public.field_production_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_production_events FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_production_events.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_production_events.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_events_upd BEFORE UPDATE ON public.field_production_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_field_events_assessment ON public.field_production_events(field_assessment_id);

-- 4. Changeover timestamp marks
CREATE TABLE IF NOT EXISTS public.field_event_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.field_production_events(id) ON DELETE CASCADE,
  mark_code text NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  original_at timestamptz,
  edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, mark_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_event_marks TO authenticated;
GRANT ALL ON public.field_event_marks TO service_role;
ALTER TABLE public.field_event_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_event_marks FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_production_events e JOIN public.field_assessments a ON a.id = e.field_assessment_id
  WHERE e.id = field_event_marks.event_id AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_production_events e JOIN public.field_assessments a ON a.id = e.field_assessment_id
  WHERE e.id = field_event_marks.event_id AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_marks_upd BEFORE UPDATE ON public.field_event_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Delays
CREATE TABLE IF NOT EXISTS public.field_delays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.field_production_events(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz,
  minutes_lost numeric,
  loss_category text NOT NULL DEFAULT 'Other',
  what_happened text,
  person_involved text,
  machine text,
  part text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_delays TO authenticated;
GRANT ALL ON public.field_delays TO service_role;
ALTER TABLE public.field_delays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_delays FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_delays.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_delays.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_delays_upd BEFORE UPDATE ON public.field_delays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_field_delays_assessment ON public.field_delays(field_assessment_id);

-- 6. Causal chain nodes
CREATE TABLE IF NOT EXISTS public.field_cause_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.field_production_events(id) ON DELETE SET NULL,
  delay_id uuid REFERENCES public.field_delays(id) ON DELETE SET NULL,
  chain_key text NOT NULL DEFAULT 'default',
  level text NOT NULL,
  description text,
  confidence text NOT NULL DEFAULT 'Low',
  validation_status text NOT NULL DEFAULT 'Suspected',
  domain_codes text[] NOT NULL DEFAULT '{}',
  is_dominant boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_cause_nodes TO authenticated;
GRANT ALL ON public.field_cause_nodes TO service_role;
ALTER TABLE public.field_cause_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_cause_nodes FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_cause_nodes.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_cause_nodes.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_causes_upd BEFORE UPDATE ON public.field_cause_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_field_causes_assessment ON public.field_cause_nodes(field_assessment_id);

-- 7. Structured evidence (files stay in field_attachments; this adds typed records)
CREATE TABLE IF NOT EXISTS public.field_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.field_production_events(id) ON DELETE SET NULL,
  delay_id uuid REFERENCES public.field_delays(id) ON DELETE SET NULL,
  cause_id uuid REFERENCES public.field_cause_nodes(id) ON DELETE SET NULL,
  observation_id uuid,
  gap_id uuid,
  evidence_type text NOT NULL DEFAULT 'ISS observation',
  description text,
  captured_by text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  machine text,
  part text,
  storage_path text,
  file_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_evidence_items TO authenticated;
GRANT ALL ON public.field_evidence_items TO service_role;
ALTER TABLE public.field_evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_evidence_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_evidence_items.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_evidence_items.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_evidence_items_upd BEFORE UPDATE ON public.field_evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_field_evidence_assessment ON public.field_evidence_items(field_assessment_id);

-- 8. SME dependency
CREATE TABLE IF NOT EXISTS public.field_sme_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  sme_name text,
  scope text,
  does_differently text,
  decisions_made text,
  undocumented_knowledge text,
  common_adjustments text,
  assistance_frequency text,
  impact_when_absent text,
  method_comparison jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_sme_dependencies TO authenticated;
GRANT ALL ON public.field_sme_dependencies TO service_role;
ALTER TABLE public.field_sme_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_sme_dependencies FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_sme_dependencies.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_sme_dependencies.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_sme_upd BEFORE UPDATE ON public.field_sme_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Baseline metrics
CREATE TABLE IF NOT EXISTS public.field_baseline_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  metric_code text,
  metric_name text NOT NULL,
  value numeric,
  unit text,
  measurement_period text,
  source text,
  evidence_note text,
  confidence text NOT NULL DEFAULT 'Low',
  data_class text NOT NULL DEFAULT 'Estimated',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_baseline_metrics TO authenticated;
GRANT ALL ON public.field_baseline_metrics TO service_role;
ALTER TABLE public.field_baseline_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_baseline_metrics FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_baseline_metrics.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_baseline_metrics.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_baseline_upd BEFORE UPDATE ON public.field_baseline_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Pilots
CREATE TABLE IF NOT EXISTS public.field_pilots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.field_opportunities(id) ON DELETE SET NULL,
  title text,
  is_recommended boolean NOT NULL DEFAULT false,
  score_frequency integer,
  score_production_impact integer,
  score_evidence_strength integer,
  score_controllability integer,
  score_feasibility integer,
  score_measurability integer,
  score_replication integer,
  scope_part text,
  scope_machine text,
  scope_fixture text,
  scope_capability_gap text,
  scope_outcome text,
  scope_exceptions text,
  current_condition text,
  validated_gap text,
  proposed_change text,
  affected_metric text,
  validation_method text,
  deliverables text,
  exclusions text,
  target_completion date,
  estimated_price numeric,
  approval_status text NOT NULL DEFAULT 'Draft',
  implementation_status text NOT NULL DEFAULT 'Not started',
  implementation_notes text,
  machine_burden_rate numeric,
  labor_rate numeric,
  production_value_hour numeric,
  scrap_cost numeric,
  overtime_cost numeric,
  other_cost_basis numeric,
  iss_implementation_cost numeric,
  hours_recovered_week numeric,
  financial_class text NOT NULL DEFAULT 'Estimated',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_pilots TO authenticated;
GRANT ALL ON public.field_pilots TO service_role;
ALTER TABLE public.field_pilots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_pilots FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_pilots.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_pilots.field_assessment_id
  AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_pilots_upd BEFORE UPDATE ON public.field_pilots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Pilot before/after metrics
CREATE TABLE IF NOT EXISTS public.field_pilot_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.field_pilots(id) ON DELETE CASCADE,
  baseline_metric_id uuid REFERENCES public.field_baseline_metrics(id) ON DELETE SET NULL,
  metric_name text NOT NULL,
  unit text,
  before_value numeric,
  after_value numeric,
  measured_at date,
  data_class text NOT NULL DEFAULT 'Observed',
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_pilot_metrics TO authenticated;
GRANT ALL ON public.field_pilot_metrics TO service_role;
ALTER TABLE public.field_pilot_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_pilot_metrics FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_pilots p JOIN public.field_assessments a ON a.id = p.field_assessment_id
  WHERE p.id = field_pilot_metrics.pilot_id AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_pilots p JOIN public.field_assessments a ON a.id = p.field_assessment_id
  WHERE p.id = field_pilot_metrics.pilot_id AND private.has_org_access(auth.uid(), a.organization_id)
  AND (private.has_role(auth.uid(),'ironiq_admin'::app_role) OR private.has_role(auth.uid(),'consultant'::app_role))));
CREATE TRIGGER t_field_pilot_metrics_upd BEFORE UPDATE ON public.field_pilot_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();