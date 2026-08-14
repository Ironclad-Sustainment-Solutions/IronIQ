CREATE TABLE public.field_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  area text NOT NULL DEFAULT '',
  work_center text,
  shift text,
  observer_name text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  capability_score numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_assessments TO authenticated;
GRANT ALL ON public.field_assessments TO service_role;
ALTER TABLE public.field_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_assessments org access" ON public.field_assessments
  FOR ALL TO authenticated
  USING (private.has_org_access(auth.uid(), organization_id))
  WITH CHECK (private.has_org_access(auth.uid(), organization_id));

CREATE TRIGGER t_field_assessments_upd BEFORE UPDATE ON public.field_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.field_assessment_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.cap_domains(id) ON DELETE CASCADE,
  score integer,
  not_applicable boolean NOT NULL DEFAULT false,
  note text,
  needs_action boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_assessment_id, domain_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_assessment_ratings TO authenticated;
GRANT ALL ON public.field_assessment_ratings TO service_role;
ALTER TABLE public.field_assessment_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_assessment_ratings org access" ON public.field_assessment_ratings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.field_assessments a
                 WHERE a.id = field_assessment_id
                   AND private.has_org_access(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a
                 WHERE a.id = field_assessment_id
                   AND private.has_org_access(auth.uid(), a.organization_id)));

CREATE TRIGGER t_field_assessment_ratings_upd BEFORE UPDATE ON public.field_assessment_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_field_assessments_org ON public.field_assessments(organization_id, observed_at DESC);
CREATE INDEX idx_field_ratings_assessment ON public.field_assessment_ratings(field_assessment_id);