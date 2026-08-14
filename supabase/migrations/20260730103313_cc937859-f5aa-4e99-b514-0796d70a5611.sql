
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ironiq_admin','consultant','customer_admin','facility_manager','assessor','executive');
CREATE TYPE public.entity_status AS ENUM ('active','inactive','archived','prospect');
CREATE TYPE public.assessment_status AS ENUM ('draft','in_progress','review','finalized','reopened');
CREATE TYPE public.finding_severity AS ENUM ('critical','high','medium','low','opportunity');
CREATE TYPE public.finding_status AS ENUM ('open','assigned','in_progress','awaiting_verification','closed','accepted_risk');
CREATE TYPE public.evidence_type AS ENUM ('none','verbal','document','record_sampled','direct_observation','system_data');
CREATE TYPE public.template_status AS ENUM ('draft','published','archived');
CREATE TYPE public.project_status AS ENUM ('proposed','planned','in_progress','on_hold','complete','cancelled');

-- UTILITY
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  job_title TEXT,
  phone TEXT,
  avatar_url TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ironiq_admin','consultant'));
$$;

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  headquarters TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'executive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_org_access(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_staff(_user_id)
      OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = _user_id AND m.organization_id = _org_id);
$$;

CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  primary_products TEXT,
  primary_processes TEXT,
  machine_count INTEGER DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  operating_shifts INTEGER DEFAULT 1,
  certifications TEXT[] DEFAULT '{}',
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  last_assessment_date DATE,
  current_readiness_score NUMERIC(5,1),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_facilities_org ON public.facilities(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.facility_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'executive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_members TO authenticated;
GRANT ALL ON public.facility_members TO service_role;
ALTER TABLE public.facility_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id UUID, _facility_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_staff(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.facilities f
        JOIN public.organization_members m ON m.organization_id = f.organization_id
        WHERE f.id = _facility_id AND m.user_id = _user_id
      );
$$;

-- TEMPLATES
CREATE TABLE public.assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status public.template_status NOT NULL DEFAULT 'draft',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_templates TO authenticated;
GRANT ALL ON public.assessment_templates TO service_role;
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.assessment_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status public.template_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_template_versions TO authenticated;
GRANT ALL ON public.assessment_template_versions TO service_role;
ALTER TABLE public.assessment_template_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID NOT NULL REFERENCES public.assessment_template_versions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC(5,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_version ON public.assessment_categories(template_version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_categories TO authenticated;
GRANT ALL ON public.assessment_categories TO service_role;
ALTER TABLE public.assessment_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.assessment_categories(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  guidance_text TEXT,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  required_evidence public.evidence_type,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_category ON public.assessment_questions(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  template_version_id UUID NOT NULL REFERENCES public.assessment_template_versions(id),
  name TEXT NOT NULL,
  assessment_type TEXT,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lead_assessor TEXT,
  supporting_assessors TEXT[] DEFAULT '{}',
  scope TEXT,
  production_area TEXT,
  product_family TEXT,
  notes TEXT,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  overall_score NUMERIC(5,1),
  confidence_score NUMERIC(5,1),
  completion_pct NUMERIC(5,1),
  readiness_level TEXT,
  has_critical_failure BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assessments_facility ON public.assessments(facility_id);
CREATE INDEX idx_assessments_org ON public.assessments(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 5)),
  not_applicable BOOLEAN NOT NULL DEFAULT false,
  comments TEXT,
  evidence_type public.evidence_type NOT NULL DEFAULT 'none',
  evidence_description TEXT,
  answered_at TIMESTAMPTZ,
  answered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);
CREATE INDEX idx_responses_assessment ON public.assessment_responses(assessment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO authenticated;
GRANT ALL ON public.assessment_responses TO service_role;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.assessment_responses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  evidence_type public.evidence_type NOT NULL DEFAULT 'document',
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

-- FINDINGS
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL,
  category_name TEXT,
  severity public.finding_severity NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  business_impact TEXT,
  root_cause TEXT,
  recommended_action TEXT,
  assigned_owner TEXT,
  target_date DATE,
  status public.finding_status NOT NULL DEFAULT 'open',
  closure_evidence TEXT,
  verified_by TEXT,
  verification_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_facility ON public.findings(facility_id);
CREATE INDEX idx_findings_status ON public.findings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  action_description TEXT NOT NULL,
  owner TEXT,
  target_date DATE,
  completed_date DATE,
  status public.finding_status NOT NULL DEFAULT 'open',
  verification_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ca_facility ON public.corrective_actions(facility_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.improvement_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner TEXT,
  executive_sponsor TEXT,
  objective TEXT,
  baseline_metric TEXT,
  target_metric TEXT,
  estimated_financial_impact NUMERIC(14,2),
  planned_start DATE,
  planned_completion DATE,
  status public.project_status NOT NULL DEFAULT 'planned',
  percent_complete INTEGER NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  risks TEXT,
  actions TEXT,
  results TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_facility ON public.improvement_projects(facility_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvement_projects TO authenticated;
GRANT ALL ON public.improvement_projects TO service_role;
ALTER TABLE public.improvement_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.improvement_projects(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, finding_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_findings TO authenticated;
GRANT ALL ON public.project_findings TO service_role;
ALTER TABLE public.project_findings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.readiness_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  recorded_on DATE NOT NULL,
  overall_score NUMERIC(5,1) NOT NULL,
  confidence_score NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_facility ON public.readiness_history(facility_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_history TO authenticated;
GRANT ALL ON public.readiness_history TO service_role;
ALTER TABLE public.readiness_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

CREATE POLICY "org read" ON public.organizations FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), id));
CREATE POLICY "org write" ON public.organizations FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "org members read" ON public.organization_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "org members write" ON public.organization_members FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "facility read" ON public.facilities FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "facility write" ON public.facilities FOR ALL TO authenticated USING (public.has_org_access(auth.uid(), organization_id)) WITH CHECK (public.has_org_access(auth.uid(), organization_id));

CREATE POLICY "facility members read" ON public.facility_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "facility members write" ON public.facility_members FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "templates read" ON public.assessment_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates write" ON public.assessment_templates FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "template versions read" ON public.assessment_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "template versions write" ON public.assessment_template_versions FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "categories read" ON public.assessment_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories write" ON public.assessment_categories FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "questions read" ON public.assessment_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions write" ON public.assessment_questions FOR ALL TO authenticated USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "assessments read" ON public.assessments FOR SELECT TO authenticated USING (public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "assessments write" ON public.assessments FOR ALL TO authenticated USING (public.has_facility_access(auth.uid(), facility_id)) WITH CHECK (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "responses read" ON public.assessment_responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(auth.uid(), a.facility_id)));
CREATE POLICY "responses write" ON public.assessment_responses FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(auth.uid(), a.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(auth.uid(), a.facility_id)));

CREATE POLICY "evidence read" ON public.evidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(auth.uid(), a.facility_id)));
CREATE POLICY "evidence write" ON public.evidence FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(auth.uid(), a.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(auth.uid(), a.facility_id)));

CREATE POLICY "findings read" ON public.findings FOR SELECT TO authenticated USING (public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "findings write" ON public.findings FOR ALL TO authenticated USING (public.has_facility_access(auth.uid(), facility_id)) WITH CHECK (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "ca read" ON public.corrective_actions FOR SELECT TO authenticated USING (public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "ca write" ON public.corrective_actions FOR ALL TO authenticated USING (public.has_facility_access(auth.uid(), facility_id)) WITH CHECK (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "projects read" ON public.improvement_projects FOR SELECT TO authenticated USING (public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "projects write" ON public.improvement_projects FOR ALL TO authenticated USING (public.has_facility_access(auth.uid(), facility_id)) WITH CHECK (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "project findings read" ON public.project_findings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(auth.uid(), p.facility_id)));
CREATE POLICY "project findings write" ON public.project_findings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(auth.uid(), p.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(auth.uid(), p.facility_id)));

CREATE POLICY "history read" ON public.readiness_history FOR SELECT TO authenticated USING (public.has_facility_access(auth.uid(), facility_id));
CREATE POLICY "history write" ON public.readiness_history FOR ALL TO authenticated USING (public.has_facility_access(auth.uid(), facility_id)) WITH CHECK (public.has_facility_access(auth.uid(), facility_id));

CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id IS NULL OR public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- TRIGGERS
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_fac_updated BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_assess_updated BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_resp_updated BEFORE UPDATE ON public.assessment_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_find_updated BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_ca_updated BEFORE UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_proj_updated BEFORE UPDATE ON public.improvement_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NEW USER BOOTSTRAP: profile + role + demo org access
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE demo_org UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, job_title)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'job_title')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultant') ON CONFLICT DO NOTHING;

  SELECT id INTO demo_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF demo_org IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (demo_org, NEW.id, 'consultant') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
