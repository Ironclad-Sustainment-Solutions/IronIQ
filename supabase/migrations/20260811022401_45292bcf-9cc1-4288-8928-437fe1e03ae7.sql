-- 1. Performance metrics (Step 2)
CREATE TABLE public.cap_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  category public.cap_perf_category NOT NULL,
  other_label text,
  metric_name text,
  current_condition text,
  current_value numeric,
  required_value numeric,
  target_value numeric,
  unit text,
  time_period text,
  data_source text,
  confidence public.cap_confidence,
  higher_is_better boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Operational observations (Step 3)
CREATE TABLE public.cap_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  area_process text,
  machine_cell text,
  observation text NOT NULL,
  performance_effect text,
  frequency text,
  severity text,
  evidence_type public.cap_evidence_type,
  evidence_note text,
  file_path text,
  assessor_notes text,
  domain_id uuid REFERENCES public.cap_domains(id) ON DELETE SET NULL,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Domain screen (Step 4)
CREATE TABLE public.cap_domain_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  domain_id uuid NOT NULL REFERENCES public.cap_domains(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_screened'
    CHECK (status IN ('healthy','potential_contributor','confirmed_contributor','significant_risk','insufficient_evidence','not_applicable','not_screened')),
  screen_items text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, domain_id)
);

-- 4. Constraint chain (Step 7)
CREATE TABLE public.cap_chain_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  step_key text NOT NULL
    CHECK (step_key IN ('customer_problem','performance_gap','observed_condition','constraint','capability_gap','operational_consequence')),
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Primary constraint (Step 8)
CREATE TABLE public.cap_primary_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  constraint_text text,
  supporting_evidence text,
  domain_id uuid REFERENCES public.cap_domains(id) ON DELETE SET NULL,
  metric_affected text,
  magnitude text,
  confidence public.cap_confidence,
  validation_status text NOT NULL DEFAULT 'suspected'
    CHECK (validation_status IN ('suspected','probable','validated')),
  declared_by uuid,
  declared_at timestamptz,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Capability health sweep (Step 10)
CREATE TABLE public.cap_health_sweep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  domain_id uuid NOT NULL REFERENCES public.cap_domains(id) ON DELETE CASCADE,
  classification text NOT NULL DEFAULT 'healthy'
    CHECK (classification IN ('healthy','capability_risk','improvement_opportunity','future_constraint','further_review')),
  note text,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, domain_id)
);

-- Column extensions
ALTER TABLE public.cap_findings
  ADD COLUMN IF NOT EXISTS criterion_id uuid REFERENCES public.cap_criteria(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS performance_impact text;

ALTER TABLE public.cap_scores
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS performance_impact text,
  ADD COLUMN IF NOT EXISTS assessor_notes text;

-- Grants, RLS, policies, timestamps
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cap_metrics','cap_observations','cap_domain_screens','cap_chain_nodes','cap_primary_constraints','cap_health_sweep']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id))',
      t || '_org_access', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      't_' || t || '_upd', t);
  END LOOP;
END $$;

CREATE INDEX ON public.cap_metrics (assessment_id);
CREATE INDEX ON public.cap_observations (assessment_id);
CREATE INDEX ON public.cap_chain_nodes (assessment_id);