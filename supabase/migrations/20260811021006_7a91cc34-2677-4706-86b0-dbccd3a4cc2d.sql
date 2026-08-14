-- New roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'programmer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_manager';

-- Enums
CREATE TYPE public.cap_assessment_status AS ENUM ('draft','intake','in_progress','review','finalized','reopened');
CREATE TYPE public.cap_perf_category AS ENUM ('production','quality','cost','delivery','workforce','throughput','downtime','capacity','scrap_rework','setup_time','lead_time','reliability');
CREATE TYPE public.cap_dimension AS ENUM ('availability','capability','consistency','control','sustainability');
CREATE TYPE public.cap_evidence_type AS ENUM ('direct_observation','customer_interview','document_review','production_data','quality_data','erp_mes_data','machine_data','photograph','file','drawing','cnc_program','setup_documentation','maintenance_record','training_record','other');
CREATE TYPE public.cap_confidence AS ENUM ('low','moderate','high','verified');
CREATE TYPE public.cap_finding_class AS ENUM ('primary_constraint','contributing_constraint','risk','opportunity','strength');
CREATE TYPE public.cap_source AS ENUM ('customer_stated','ironclad_validated');
CREATE TYPE public.cap_priority AS ENUM ('immediate','high','moderate','monitor');
CREATE TYPE public.cap_action_status AS ENUM ('identified','recommended','approved','in_progress','validation','complete','sustained');
CREATE TYPE public.cap_validation_result AS ENUM ('capability_restored','capability_strengthened','partially_restored','additional_action_required','performance_degraded');

-- Reference: domains + criteria (global library)
CREATE TABLE public.cap_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  verb text NOT NULL,
  key_question text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cap_domains TO authenticated;
GRANT ALL ON public.cap_domains TO service_role;
ALTER TABLE public.cap_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_domains readable" ON public.cap_domains FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.cap_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.cap_domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cap_criteria TO authenticated;
GRANT ALL ON public.cap_criteria TO service_role;
ALTER TABLE public.cap_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_criteria readable" ON public.cap_criteria FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Assessments
CREATE TABLE public.cap_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  name text NOT NULL,
  assessment_date date NOT NULL DEFAULT current_date,
  lead_assessor text,
  scope text,
  status public.cap_assessment_status NOT NULL DEFAULT 'draft',
  overall_score numeric(4,2),
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_assessments TO authenticated;
GRANT ALL ON public.cap_assessments TO service_role;
ALTER TABLE public.cap_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_assessments org access" ON public.cap_assessments FOR ALL TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.cap_can_access(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cap_assessments a
    WHERE a.id = _assessment_id AND public.has_org_access(auth.uid(), a.organization_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.cap_can_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cap_can_access(uuid) TO authenticated;

-- Customer problem intake
CREATE TABLE public.cap_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  q_greatest_impact text,
  q_where_when text,
  q_effect text,
  q_tried text,
  q_if_resolved text,
  stated_problem text,
  location_process text,
  performance_impact text,
  previous_actions text,
  desired_outcome text,
  entered_by_role text,
  ai_summary_pending boolean NOT NULL DEFAULT false,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_problems TO authenticated;
GRANT ALL ON public.cap_problems TO service_role;
ALTER TABLE public.cap_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_problems access" ON public.cap_problems FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

-- Performance impacts
CREATE TABLE public.cap_performance_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  category public.cap_perf_category NOT NULL,
  current_condition text,
  desired_condition text,
  metric_name text,
  current_value numeric,
  target_value numeric,
  unit text,
  data_source text,
  evidence text,
  assessor_notes text,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_performance_impacts TO authenticated;
GRANT ALL ON public.cap_performance_impacts TO service_role;
ALTER TABLE public.cap_performance_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_impacts access" ON public.cap_performance_impacts FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

-- Scores
CREATE TABLE public.cap_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.cap_criteria(id) ON DELETE CASCADE,
  dimension public.cap_dimension NOT NULL,
  score int CHECK (score IS NULL OR (score >= 0 AND score <= 5)),
  not_applicable boolean NOT NULL DEFAULT false,
  rationale text,
  confidence public.cap_confidence,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, criterion_id, dimension)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_scores TO authenticated;
GRANT ALL ON public.cap_scores TO service_role;
ALTER TABLE public.cap_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_scores access" ON public.cap_scores FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

-- Findings
CREATE TABLE public.cap_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  title text NOT NULL,
  finding_text text,
  domain_id uuid REFERENCES public.cap_domains(id) ON DELETE SET NULL,
  dimension public.cap_dimension,
  classification public.cap_finding_class NOT NULL DEFAULT 'risk',
  severity public.finding_severity NOT NULL DEFAULT 'medium',
  confidence public.cap_confidence NOT NULL DEFAULT 'moderate',
  source public.cap_source NOT NULL DEFAULT 'ironclad_validated',
  assessor_notes text,
  ai_generated boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  client_visible boolean NOT NULL DEFAULT false,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_findings TO authenticated;
GRANT ALL ON public.cap_findings TO service_role;
ALTER TABLE public.cap_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_findings access" ON public.cap_findings FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

CREATE TABLE public.cap_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.cap_findings(id) ON DELETE CASCADE,
  evidence_type public.cap_evidence_type NOT NULL DEFAULT 'other',
  description text,
  source text,
  file_path text,
  captured_on date,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_evidence TO authenticated;
GRANT ALL ON public.cap_evidence TO service_role;
ALTER TABLE public.cap_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_evidence access" ON public.cap_evidence FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cap_findings f WHERE f.id = finding_id AND public.cap_can_access(f.assessment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cap_findings f WHERE f.id = finding_id AND public.cap_can_access(f.assessment_id)));

CREATE TABLE public.cap_finding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_finding_id uuid NOT NULL REFERENCES public.cap_findings(id) ON DELETE CASCADE,
  child_finding_id uuid NOT NULL REFERENCES public.cap_findings(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'caused_by',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_finding_id, child_finding_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_finding_links TO authenticated;
GRANT ALL ON public.cap_finding_links TO service_role;
ALTER TABLE public.cap_finding_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_links access" ON public.cap_finding_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cap_findings f WHERE f.id = parent_finding_id AND public.cap_can_access(f.assessment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cap_findings f WHERE f.id = parent_finding_id AND public.cap_can_access(f.assessment_id)));

-- Root capability gaps
CREATE TABLE public.cap_root_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  observed_problem text NOT NULL,
  immediate_cause text,
  contributing_factors text,
  root_gap text NOT NULL,
  domain_id uuid REFERENCES public.cap_domains(id) ON DELETE SET NULL,
  dimension public.cap_dimension,
  operational_consequence text,
  validated boolean NOT NULL DEFAULT false,
  confidence public.cap_confidence NOT NULL DEFAULT 'moderate',
  primary_finding_id uuid REFERENCES public.cap_findings(id) ON DELETE SET NULL,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_root_gaps TO authenticated;
GRANT ALL ON public.cap_root_gaps TO service_role;
ALTER TABLE public.cap_root_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_gaps access" ON public.cap_root_gaps FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

-- Restoration actions
CREATE TABLE public.cap_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  root_gap_id uuid REFERENCES public.cap_root_gaps(id) ON DELETE SET NULL,
  capability_gap text,
  recommended_action text NOT NULL,
  expected_outcome text,
  metric_name text,
  baseline_value numeric,
  target_value numeric,
  unit text,
  responsible_party text,
  target_date date,
  status public.cap_action_status NOT NULL DEFAULT 'identified',
  required_resources text,
  estimated_effort text,
  dependencies text,
  validation_method text,
  priority public.cap_priority NOT NULL DEFAULT 'moderate',
  priority_score numeric,
  priority_override_justification text,
  impact_rating int, urgency_rating int, severity_rating int, frequency_rating int,
  cost_exposure int, delivery_exposure int, quality_exposure int, workforce_dependency int,
  ease_of_restoration int, expected_benefit int, confidence_rating int,
  ai_generated boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_actions TO authenticated;
GRANT ALL ON public.cap_actions TO service_role;
ALTER TABLE public.cap_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_actions access" ON public.cap_actions FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

CREATE TABLE public.cap_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.cap_actions(id) ON DELETE CASCADE,
  measured_on date NOT NULL DEFAULT current_date,
  actual_value numeric NOT NULL,
  notes text,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_results TO authenticated;
GRANT ALL ON public.cap_results TO service_role;
ALTER TABLE public.cap_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_results access" ON public.cap_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cap_actions a WHERE a.id = action_id AND public.cap_can_access(a.assessment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cap_actions a WHERE a.id = action_id AND public.cap_can_access(a.assessment_id)));

CREATE TABLE public.cap_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.cap_actions(id) ON DELETE CASCADE,
  interval_days int NOT NULL DEFAULT 30,
  validated_on date NOT NULL DEFAULT current_date,
  improvement_holding boolean,
  repeatable boolean,
  process_controlled boolean,
  knowledge_documented boolean,
  others_can_execute boolean,
  performance_measured boolean,
  capability_stable boolean,
  result public.cap_validation_result NOT NULL DEFAULT 'partially_restored',
  notes text,
  validated_by uuid,
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_validations TO authenticated;
GRANT ALL ON public.cap_validations TO service_role;
ALTER TABLE public.cap_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_validations access" ON public.cap_validations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cap_actions a WHERE a.id = action_id AND public.cap_can_access(a.assessment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cap_actions a WHERE a.id = action_id AND public.cap_can_access(a.assessment_id)));

CREATE TABLE public.cap_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.cap_assessments(id) ON DELETE CASCADE,
  title text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  modified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_reports TO authenticated;
GRANT ALL ON public.cap_reports TO service_role;
ALTER TABLE public.cap_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_reports access" ON public.cap_reports FOR ALL TO authenticated
  USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id));

-- updated_at triggers
CREATE TRIGGER t_cap_assessments_upd BEFORE UPDATE ON public.cap_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_problems_upd BEFORE UPDATE ON public.cap_problems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_impacts_upd BEFORE UPDATE ON public.cap_performance_impacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_scores_upd BEFORE UPDATE ON public.cap_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_findings_upd BEFORE UPDATE ON public.cap_findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_evidence_upd BEFORE UPDATE ON public.cap_evidence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_gaps_upd BEFORE UPDATE ON public.cap_root_gaps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_actions_upd BEFORE UPDATE ON public.cap_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_results_upd BEFORE UPDATE ON public.cap_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_validations_upd BEFORE UPDATE ON public.cap_validations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_cap_reports_upd BEFORE UPDATE ON public.cap_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed domains
INSERT INTO public.cap_domains (code, name, verb, key_question, sort_order) VALUES
 ('technical_data','Technical Data','DEFINE IT','Can the organization clearly and accurately define what needs to be manufactured?',1),
 ('digital_manufacturing','Digital Manufacturing','DIGITIZE IT','Can the organization digitally support manufacturing execution?',2),
 ('production_support','Production Support','SUPPORT IT','Does production consistently have everything required to execute?',3),
 ('production_operations','Production Operations','EXECUTE IT','Can the operation consistently convert resources into predictable manufacturing output?',4),
 ('equipment_infrastructure','Equipment & Infrastructure','ENABLE IT','Can the physical assets and supporting infrastructure reliably support required production?',5),
 ('workforce_knowledge','Workforce & Knowledge','SUSTAIN IT','Can the organization sustain the capability without excessive dependence on specific individuals?',6);

-- Seed criteria
INSERT INTO public.cap_criteria (domain_id, name, sort_order)
SELECT d.id, c.name, c.ord FROM public.cap_domains d
JOIN (VALUES
 ('technical_data','Drawings',1),('technical_data','Specifications',2),('technical_data','Bills of Material',3),
 ('technical_data','Revision Control',4),('technical_data','Product Knowledge',5),('technical_data','Process Documentation',6),
 ('technical_data','Technical Requirements',7),('technical_data','Data Availability',8),('technical_data','Configuration Control',9),
 ('digital_manufacturing','CAD Models',1),('digital_manufacturing','CAM Programming',2),('digital_manufacturing','CNC Programs',3),
 ('digital_manufacturing','Digital Manufacturing Packages',4),('digital_manufacturing','File Organization',5),
 ('digital_manufacturing','Manufacturing Data Control',6),('digital_manufacturing','Program Revision Control',7),
 ('digital_manufacturing','Data Accessibility',8),('digital_manufacturing','Digital Knowledge Preservation',9),
 ('production_support','Tooling',1),('production_support','Fixtures',2),('production_support','Workholding',3),
 ('production_support','Setup Planning',4),('production_support','Work Instructions',5),('production_support','Inspection Planning',6),
 ('production_support','Process Documentation',7),('production_support','Material Availability',8),('production_support','Production Preparation',9),
 ('production_operations','Workflow',1),('production_operations','Capacity',2),('production_operations','Scheduling',3),
 ('production_operations','Throughput',4),('production_operations','Bottlenecks',5),('production_operations','WIP',6),
 ('production_operations','Downtime',7),('production_operations','Setup Performance',8),('production_operations','Production Control',9),
 ('production_operations','Process Flow',10),
 ('equipment_infrastructure','Equipment Availability',1),('equipment_infrastructure','Machine Capability',2),
 ('equipment_infrastructure','Maintenance',3),('equipment_infrastructure','Reliability',4),('equipment_infrastructure','Utilities',5),
 ('equipment_infrastructure','Facility Layout',6),('equipment_infrastructure','Material Flow',7),
 ('equipment_infrastructure','Supporting Infrastructure',8),('equipment_infrastructure','Equipment Constraints',9),
 ('workforce_knowledge','Workforce Skills',1),('workforce_knowledge','Training',2),('workforce_knowledge','Cross-Training',3),
 ('workforce_knowledge','Standard Work',4),('workforce_knowledge','Knowledge Retention',5),('workforce_knowledge','Tribal Knowledge',6),
 ('workforce_knowledge','Critical Personnel Dependencies',7),('workforce_knowledge','Staffing',8),
 ('workforce_knowledge','Technical Competency',9),('workforce_knowledge','Succession / Knowledge Transfer',10)
) AS c(domain_code, name, ord) ON c.domain_code = d.code;