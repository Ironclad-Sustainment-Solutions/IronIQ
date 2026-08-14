ALTER TABLE public.field_assessments
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS assessors text,
  ADD COLUMN IF NOT EXISTS primary_concern text,
  ADD COLUMN IF NOT EXISTS problem_statement text,
  ADD COLUMN IF NOT EXISTS problem_area text,
  ADD COLUMN IF NOT EXISTS problem_process text,
  ADD COLUMN IF NOT EXISTS problem_timing text,
  ADD COLUMN IF NOT EXISTS impact_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS impact_other text,
  ADD COLUMN IF NOT EXISTS attempted text,
  ADD COLUMN IF NOT EXISTS improvement_if_resolved text,
  ADD COLUMN IF NOT EXISTS workstreams text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS summary_observed text,
  ADD COLUMN IF NOT EXISTS summary_constraint text,
  ADD COLUMN IF NOT EXISTS summary_why text,
  ADD COLUMN IF NOT EXISTS summary_opportunity text,
  ADD COLUMN IF NOT EXISTS summary_recommendation text,
  ADD COLUMN IF NOT EXISTS summary_outcome text;

CREATE TABLE public.field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  section_code text NOT NULL,
  area_code text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  not_observed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_assessment_id, area_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_observations TO authenticated;
GRANT ALL ON public.field_observations TO service_role;
ALTER TABLE public.field_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_observations org access" ON public.field_observations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_observations_upd BEFORE UPDATE ON public.field_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_field_observations_assessment ON public.field_observations(field_assessment_id);

CREATE TABLE public.field_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  gap_number integer,
  location text,
  observed_condition text,
  objective_evidence text,
  missing_capability text,
  impact_tags text[] NOT NULL DEFAULT '{}',
  severity text,
  frequency text,
  root_capability text,
  current_state text,
  capability_needed text,
  ironclad_action text,
  expected_result text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_gaps TO authenticated;
GRANT ALL ON public.field_gaps TO service_role;
ALTER TABLE public.field_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_gaps org access" ON public.field_gaps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_gaps_upd BEFORE UPDATE ON public.field_gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_field_gaps_assessment ON public.field_gaps(field_assessment_id);

CREATE TABLE public.field_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 1,
  capability_gap text,
  evidence text,
  production_impact text,
  ironclad_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_constraints TO authenticated;
GRANT ALL ON public.field_constraints TO service_role;
ALTER TABLE public.field_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_constraints org access" ON public.field_constraints
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_constraints_upd BEFORE UPDATE ON public.field_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_field_constraints_assessment ON public.field_constraints(field_assessment_id);

CREATE TABLE public.field_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  opportunity text,
  impact text,
  effort text,
  priority text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_opportunities TO authenticated;
GRANT ALL ON public.field_opportunities TO service_role;
ALTER TABLE public.field_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_opportunities org access" ON public.field_opportunities
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(auth.uid(), a.organization_id)));
CREATE TRIGGER t_field_opportunities_upd BEFORE UPDATE ON public.field_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_field_opportunities_assessment ON public.field_opportunities(field_assessment_id);