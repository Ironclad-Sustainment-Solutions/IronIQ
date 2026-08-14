-- =====================================================================
-- Foundation: roles + auth tables that replace Supabase Auth.
-- Everything after this point is the app's original schema (converted:
-- auth.users -> public.app_users, auth.uid() -> public.current_user_id()).
-- =====================================================================

-- Roles. The app connects as app_user (RLS-enforced) for normal requests
-- and app_admin (BYPASSRLS) only for trusted server-side admin operations
-- — the same split Supabase's `authenticated` / `service_role` provided.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_anon') THEN
    CREATE ROLE app_anon NOLOGIN;
  END IF;
END $$;

-- The actual DB connection user (from DATABASE_URL) needs to be able to
-- switch into app_user/app_admin per-request. Grant that at deploy time:
--   GRANT app_user, app_admin TO <your_connection_user>;
-- (documented in MIGRATION_PHASE2.md)

-- Replaces Supabase's auth.users.
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_users TO app_user;
GRANT ALL ON public.app_users TO app_admin;

-- Replaces Supabase Auth's session/refresh-token handling.
CREATE TABLE public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX app_sessions_user_id_idx ON public.app_sessions(user_id);
GRANT ALL ON public.app_sessions TO app_admin;

-- RLS equivalent of Supabase's auth.uid(): the app sets this per-transaction
-- via `SET LOCAL app.current_user_id = '<uuid>'` (see src/lib/db.server.ts).
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;


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
  id UUID PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  job_title TEXT,
  phone TEXT,
  avatar_url TEXT,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO app_user;
GRANT ALL ON public.profiles TO app_admin;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO app_user;
GRANT ALL ON public.user_roles TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO app_user;
GRANT ALL ON public.organizations TO app_admin;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'executive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO app_user;
GRANT ALL ON public.organization_members TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO app_user;
GRANT ALL ON public.facilities TO app_admin;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.facility_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'executive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_members TO app_user;
GRANT ALL ON public.facility_members TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_templates TO app_user;
GRANT ALL ON public.assessment_templates TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_template_versions TO app_user;
GRANT ALL ON public.assessment_template_versions TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_categories TO app_user;
GRANT ALL ON public.assessment_categories TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_questions TO app_user;
GRANT ALL ON public.assessment_questions TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO app_user;
GRANT ALL ON public.assessments TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO app_user;
GRANT ALL ON public.assessment_responses TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence TO app_user;
GRANT ALL ON public.evidence TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO app_user;
GRANT ALL ON public.findings TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO app_user;
GRANT ALL ON public.corrective_actions TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvement_projects TO app_user;
GRANT ALL ON public.improvement_projects TO app_admin;
ALTER TABLE public.improvement_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.improvement_projects(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES public.findings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, finding_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_findings TO app_user;
GRANT ALL ON public.project_findings TO app_admin;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_history TO app_user;
GRANT ALL ON public.readiness_history TO app_admin;
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
GRANT SELECT, INSERT ON public.audit_logs TO app_user;
GRANT ALL ON public.audit_logs TO app_admin;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO app_user USING (id = public.current_user_id() OR public.is_platform_staff(public.current_user_id()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO app_user WITH CHECK (id = public.current_user_id());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO app_user USING (id = public.current_user_id()) WITH CHECK (id = public.current_user_id());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO app_user USING (user_id = public.current_user_id() OR public.is_platform_staff(public.current_user_id()));

CREATE POLICY "org read" ON public.organizations FOR SELECT TO app_user USING (public.has_org_access(public.current_user_id(), id));
CREATE POLICY "org write" ON public.organizations FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));

CREATE POLICY "org members read" ON public.organization_members FOR SELECT TO app_user USING (user_id = public.current_user_id() OR public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "org members write" ON public.organization_members FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));

CREATE POLICY "facility read" ON public.facilities FOR SELECT TO app_user USING (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "facility write" ON public.facilities FOR ALL TO app_user USING (public.has_org_access(public.current_user_id(), organization_id)) WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));

CREATE POLICY "facility members read" ON public.facility_members FOR SELECT TO app_user USING (user_id = public.current_user_id() OR public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "facility members write" ON public.facility_members FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));

CREATE POLICY "templates read" ON public.assessment_templates FOR SELECT TO app_user USING (true);
CREATE POLICY "templates write" ON public.assessment_templates FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "template versions read" ON public.assessment_template_versions FOR SELECT TO app_user USING (true);
CREATE POLICY "template versions write" ON public.assessment_template_versions FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "categories read" ON public.assessment_categories FOR SELECT TO app_user USING (true);
CREATE POLICY "categories write" ON public.assessment_categories FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "questions read" ON public.assessment_questions FOR SELECT TO app_user USING (true);
CREATE POLICY "questions write" ON public.assessment_questions FOR ALL TO app_user USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));

CREATE POLICY "assessments read" ON public.assessments FOR SELECT TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "assessments write" ON public.assessments FOR ALL TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id)) WITH CHECK (public.has_facility_access(public.current_user_id(), facility_id));

CREATE POLICY "responses read" ON public.assessment_responses FOR SELECT TO app_user USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(public.current_user_id(), a.facility_id)));
CREATE POLICY "responses write" ON public.assessment_responses FOR ALL TO app_user USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(public.current_user_id(), a.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.has_facility_access(public.current_user_id(), a.facility_id)));

CREATE POLICY "evidence read" ON public.evidence FOR SELECT TO app_user USING (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(public.current_user_id(), a.facility_id)));
CREATE POLICY "evidence write" ON public.evidence FOR ALL TO app_user USING (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(public.current_user_id(), a.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_responses r JOIN public.assessments a ON a.id = r.assessment_id WHERE r.id = response_id AND public.has_facility_access(public.current_user_id(), a.facility_id)));

CREATE POLICY "findings read" ON public.findings FOR SELECT TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "findings write" ON public.findings FOR ALL TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id)) WITH CHECK (public.has_facility_access(public.current_user_id(), facility_id));

CREATE POLICY "ca read" ON public.corrective_actions FOR SELECT TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "ca write" ON public.corrective_actions FOR ALL TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id)) WITH CHECK (public.has_facility_access(public.current_user_id(), facility_id));

CREATE POLICY "projects read" ON public.improvement_projects FOR SELECT TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "projects write" ON public.improvement_projects FOR ALL TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id)) WITH CHECK (public.has_facility_access(public.current_user_id(), facility_id));

CREATE POLICY "project findings read" ON public.project_findings FOR SELECT TO app_user USING (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(public.current_user_id(), p.facility_id)));
CREATE POLICY "project findings write" ON public.project_findings FOR ALL TO app_user USING (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(public.current_user_id(), p.facility_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.improvement_projects p WHERE p.id = project_id AND public.has_facility_access(public.current_user_id(), p.facility_id)));

CREATE POLICY "history read" ON public.readiness_history FOR SELECT TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id));
CREATE POLICY "history write" ON public.readiness_history FOR ALL TO app_user USING (public.has_facility_access(public.current_user_id(), facility_id)) WITH CHECK (public.has_facility_access(public.current_user_id(), facility_id));

CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO app_user USING (organization_id IS NULL OR public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO app_user WITH CHECK (true);

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

CREATE TRIGGER on_auth_user_created AFTER INSERT ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE FUNCTION public.enforce_response_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_id uuid; st assessment_status;
BEGIN
  target_id := COALESCE(NEW.assessment_id, OLD.assessment_id);
  SELECT status INTO st FROM public.assessments WHERE id = target_id;
  IF st = 'finalized' THEN
    RAISE EXCEPTION 'Assessment is finalized and read-only. Reopen it before editing responses.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_responses_editable ON public.assessment_responses;
CREATE TRIGGER trg_responses_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.enforce_response_editable();

CREATE OR REPLACE FUNCTION public.next_finding_code()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'MRA-' || to_char(now(), 'YYYY') || '-' ||
         lpad((COALESCE(MAX(NULLIF(regexp_replace(finding_code, '^.*-', ''), '')::int), 0) + 1)::text, 3, '0')
  FROM public.findings
  WHERE finding_code LIKE 'MRA-' || to_char(now(), 'YYYY') || '-%';
$$;

CREATE UNIQUE INDEX IF NOT EXISTS findings_assessment_question_uniq
  ON public.findings (assessment_id, question_id)
  WHERE assessment_id IS NOT NULL AND question_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_responses_updated_at ON public.assessment_responses;
CREATE TRIGGER trg_responses_updated_at
BEFORE UPDATE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- 1. audit_logs: restrict inserts to the acting user and their accessible scope
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
FOR INSERT TO app_user
WITH CHECK (
  actor_id = public.current_user_id()
  AND (organization_id IS NULL OR public.has_org_access(public.current_user_id(), organization_id))
  AND (facility_id IS NULL OR public.has_facility_access(public.current_user_id(), facility_id))
);

-- 2. user_roles: explicit admin-only management path
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
FOR ALL TO app_user
USING (public.has_role(public.current_user_id(), 'ironiq_admin'))
WITH CHECK (public.has_role(public.current_user_id(), 'ironiq_admin'));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO app_user;

-- 3. Lock down SECURITY DEFINER / internal functions
-- Internal trigger + bootstrap helpers: not callable by any API role
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, app_anon, app_user;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, app_anon, app_user;
REVOKE ALL ON FUNCTION public.enforce_response_editable() FROM PUBLIC, app_anon, app_user;

-- Access-check helpers are required by RLS policies for signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.has_org_access(uuid, uuid) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.has_facility_access(uuid, uuid) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.next_finding_code() FROM PUBLIC, app_anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO app_user;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.has_facility_access(uuid, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.next_finding_code() TO app_user;CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = public.current_user_id()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = public.current_user_id()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ironiq_admin','consultant'));
$$;

CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = public.current_user_id()
     AND (
       public.is_platform_staff(_user_id)
       OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = _user_id AND m.organization_id = _org_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id uuid, _facility_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = public.current_user_id()
     AND (
       public.is_platform_staff(_user_id)
       OR EXISTS (
         SELECT 1 FROM public.facilities f
         JOIN public.organization_members m ON m.organization_id = f.organization_id
         WHERE f.id = _facility_id AND m.user_id = _user_id
       )
     );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.has_org_access(uuid, uuid) FROM PUBLIC, app_anon;
REVOKE ALL ON FUNCTION public.has_facility_access(uuid, uuid) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO app_user;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.has_org_access(uuid, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.has_facility_access(uuid, uuid) TO app_user;-- ---------- columns ----------
ALTER TABLE public.assessment_templates
  ADD COLUMN IF NOT EXISTS template_code text,
  ADD COLUMN IF NOT EXISTS intended_use text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS assessment_type text,
  ADD COLUMN IF NOT EXISTS owner_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_code ON public.assessment_templates (lower(template_code)) WHERE template_code IS NOT NULL;

ALTER TABLE public.assessment_categories
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_version_code ON public.assessment_categories (template_version_id, lower(code));

ALTER TABLE public.assessment_questions
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_not_applicable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_finding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_severity finding_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.assessment_questions SET weight = 1 WHERE weight IS NULL OR weight <= 0;
UPDATE public.assessment_questions SET default_severity = 'critical' WHERE is_critical;

ALTER TABLE public.assessment_questions
  DROP CONSTRAINT IF EXISTS chk_question_weight_positive;
ALTER TABLE public.assessment_questions
  ADD CONSTRAINT chk_question_weight_positive CHECK (weight > 0);

-- ---------- authorization helper ----------
CREATE OR REPLACE FUNCTION public.can_edit_template(_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_id() IS NOT NULL
     AND (
       public.is_platform_staff(public.current_user_id())
       OR EXISTS (
         SELECT 1
         FROM public.assessment_templates t
         JOIN public.organization_members m ON m.organization_id = t.owner_organization_id
         WHERE t.id = _template_id
           AND m.user_id = public.current_user_id()
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = public.current_user_id() AND r.role = 'customer_admin')
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_edit_template(uuid) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.can_edit_template(uuid) TO app_user;

-- ---------- immutability ----------
CREATE OR REPLACE FUNCTION public.enforce_version_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; st template_status;
BEGIN
  IF TG_TABLE_NAME = 'assessment_categories' THEN
    v_id := COALESCE(NEW.template_version_id, OLD.template_version_id);
  ELSE
    SELECT c.template_version_id INTO v_id FROM public.assessment_categories c
     WHERE c.id = COALESCE(NEW.category_id, OLD.category_id);
  END IF;

  SELECT status INTO st FROM public.assessment_template_versions WHERE id = v_id;
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This template version is % and is read-only. Create a new draft version to make changes.', COALESCE(st::text, 'missing');
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.enforce_version_editable() FROM PUBLIC, app_anon, app_user;

DROP TRIGGER IF EXISTS trg_categories_editable ON public.assessment_categories;
CREATE TRIGGER trg_categories_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_editable();

DROP TRIGGER IF EXISTS trg_questions_editable ON public.assessment_questions;
CREATE TRIGGER trg_questions_editable
BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_editable();

CREATE OR REPLACE FUNCTION public.enforce_unique_question_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; dupes int;
BEGIN
  SELECT template_version_id INTO v_id FROM public.assessment_categories WHERE id = NEW.category_id;
  SELECT count(*) INTO dupes
    FROM public.assessment_questions q
    JOIN public.assessment_categories c ON c.id = q.category_id
   WHERE c.template_version_id = v_id
     AND lower(q.question_code) = lower(NEW.question_code)
     AND q.id <> NEW.id;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Question ID % already exists in this template version.', NEW.question_code;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.enforce_unique_question_code() FROM PUBLIC, app_anon, app_user;

DROP TRIGGER IF EXISTS trg_questions_unique_code ON public.assessment_questions;
CREATE TRIGGER trg_questions_unique_code
BEFORE INSERT OR UPDATE ON public.assessment_questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_question_code();

CREATE OR REPLACE FUNCTION public.enforce_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published template versions cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status NOT IN ('published','archived')
       OR NEW.version <> OLD.version
       OR NEW.template_id <> OLD.template_id
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Published template versions are immutable. Create a new draft version instead.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.enforce_version_lifecycle() FROM PUBLIC, app_anon, app_user;

DROP TRIGGER IF EXISTS trg_versions_lifecycle ON public.assessment_template_versions;
CREATE TRIGGER trg_versions_lifecycle
BEFORE UPDATE OR DELETE ON public.assessment_template_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_version_lifecycle();

-- ---------- clone + publish ----------
CREATE OR REPLACE FUNCTION public.clone_template_version(_version_id uuid, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE src record; new_version int; new_id uuid; cat record; new_cat uuid;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT public.can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to create versions of this template.';
  END IF;

  SELECT COALESCE(MAX(version),0) + 1 INTO new_version
    FROM public.assessment_template_versions WHERE template_id = src.template_id;

  INSERT INTO public.assessment_template_versions (template_id, version, status, notes)
  VALUES (src.template_id, new_version, 'draft', COALESCE(_notes, 'Draft copied from v' || src.version))
  RETURNING id INTO new_id;

  FOR cat IN SELECT * FROM public.assessment_categories WHERE template_version_id = _version_id ORDER BY sort_order LOOP
    INSERT INTO public.assessment_categories (template_version_id, code, name, description, weight, sort_order, archived)
    VALUES (new_id, cat.code, cat.name, cat.description, cat.weight, cat.sort_order, cat.archived)
    RETURNING id INTO new_cat;

    INSERT INTO public.assessment_questions
      (category_id, question_code, question_text, guidance_text, weight, is_critical, required_evidence,
       sort_order, is_required, allow_not_applicable, auto_finding, default_severity, archived)
    SELECT new_cat, q.question_code, q.question_text, q.guidance_text, q.weight, q.is_critical, q.required_evidence,
           q.sort_order, q.is_required, q.allow_not_applicable, q.auto_finding, q.default_severity, q.archived
      FROM public.assessment_questions q WHERE q.category_id = cat.id ORDER BY q.sort_order;
  END LOOP;

  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.clone_template_version(uuid, text) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.clone_template_version(uuid, text) TO app_user;

CREATE OR REPLACE FUNCTION public.publish_template_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE src record; total numeric; cat_count int; bad int;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT public.can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to publish this template.';
  END IF;
  IF src.status <> 'draft' THEN RAISE EXCEPTION 'Only draft versions can be published.'; END IF;

  SELECT COALESCE(SUM(weight),0), count(*) INTO total, cat_count
    FROM public.assessment_categories WHERE template_version_id = _version_id AND archived = false;
  IF cat_count = 0 THEN RAISE EXCEPTION 'Add at least one category before publishing.'; END IF;
  IF round(total,2) <> 100.00 THEN RAISE EXCEPTION 'Category weights must total exactly 100%% (currently %).', round(total,2); END IF;

  SELECT count(*) INTO bad FROM public.assessment_categories c
   WHERE c.template_version_id = _version_id AND c.archived = false
     AND NOT EXISTS (SELECT 1 FROM public.assessment_questions q WHERE q.category_id = c.id AND q.archived = false);
  IF bad > 0 THEN RAISE EXCEPTION 'Every category must contain at least one active question.'; END IF;

  SELECT count(*) INTO bad FROM public.assessment_questions q
    JOIN public.assessment_categories c ON c.id = q.category_id
   WHERE c.template_version_id = _version_id AND q.archived = false
     AND (q.weight <= 0 OR btrim(q.question_text) = '' OR btrim(q.question_code) = '');
  IF bad > 0 THEN RAISE EXCEPTION 'All active questions need an ID, text and a weight greater than zero.'; END IF;

  UPDATE public.assessment_template_versions
     SET status = 'published', published_at = now(), published_by = public.current_user_id(), updated_at = now()
   WHERE id = _version_id;

  UPDATE public.assessment_templates
     SET status = 'published', updated_at = now(), updated_by = public.current_user_id()
   WHERE id = src.template_id AND status = 'draft';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (public.current_user_id(), 'template_version_published', 'assessment_template_version', _version_id,
          jsonb_build_object('template_id', src.template_id, 'version', src.version));
END; $$;

REVOKE ALL ON FUNCTION public.publish_template_version(uuid) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.publish_template_version(uuid) TO app_user;

-- ---------- RLS: allow customer-owned draft authoring ----------
DROP POLICY IF EXISTS "templates write" ON public.assessment_templates;
CREATE POLICY "templates write" ON public.assessment_templates
  TO app_user
  USING (public.is_platform_staff(public.current_user_id()) OR public.can_edit_template(id))
  WITH CHECK (
    public.is_platform_staff(public.current_user_id())
    OR (
      owner_organization_id IS NOT NULL
      AND public.has_org_access(public.current_user_id(), owner_organization_id)
      AND public.has_role(public.current_user_id(), 'customer_admin')
    )
  );

DROP POLICY IF EXISTS "template versions write" ON public.assessment_template_versions;
CREATE POLICY "template versions write" ON public.assessment_template_versions
  TO app_user
  USING (public.can_edit_template(template_id))
  WITH CHECK (public.can_edit_template(template_id));

DROP POLICY IF EXISTS "categories write" ON public.assessment_categories;
CREATE POLICY "categories write" ON public.assessment_categories
  TO app_user
  USING (EXISTS (SELECT 1 FROM public.assessment_template_versions v WHERE v.id = template_version_id AND public.can_edit_template(v.template_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_template_versions v WHERE v.id = template_version_id AND public.can_edit_template(v.template_id)));

DROP POLICY IF EXISTS "questions write" ON public.assessment_questions;
CREATE POLICY "questions write" ON public.assessment_questions
  TO app_user
  USING (EXISTS (
    SELECT 1 FROM public.assessment_categories c
    JOIN public.assessment_template_versions v ON v.id = c.template_version_id
    WHERE c.id = category_id AND public.can_edit_template(v.template_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_categories c
    JOIN public.assessment_template_versions v ON v.id = c.template_version_id
    WHERE c.id = category_id AND public.can_edit_template(v.template_id)));
CREATE OR REPLACE FUNCTION public.enforce_version_editable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_id uuid; st template_status; found_version boolean;
BEGIN
  IF TG_TABLE_NAME = 'assessment_categories' THEN
    v_id := COALESCE(NEW.template_version_id, OLD.template_version_id);
  ELSE
    SELECT c.template_version_id INTO v_id FROM public.assessment_categories c
     WHERE c.id = COALESCE(NEW.category_id, OLD.category_id);
    -- Parent category already removed (cascade delete): nothing left to protect.
    IF v_id IS NULL AND TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
  END IF;

  SELECT status, TRUE INTO st, found_version
    FROM public.assessment_template_versions WHERE id = v_id;

  -- Version row already removed (cascade delete of a draft version): allow.
  IF NOT COALESCE(found_version, FALSE) AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'This template version is % and is read-only. Create a new draft version to make changes.', COALESCE(st::text, 'missing');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_version_editable() FROM PUBLIC, app_anon, app_user;-- ENUMS
CREATE TYPE public.rfq_status AS ENUM ('new','awaiting_information','geometry_analysis','ready_for_estimating','awaiting_internal_approval','quote_sent','quote_accepted','programming','awaiting_verification','completed','declined','expired');
CREATE TYPE public.rfq_kind AS ENUM ('prototype','repeat_production','new_production');
CREATE TYPE public.machine_type AS ENUM ('mill_3axis','mill_4axis','mill_5axis','lathe','mill_turn','router','edm','grinding','other');
CREATE TYPE public.estimate_confidence AS ENUM ('high','moderate','low','manual_required');
CREATE TYPE public.quote_status AS ENUM ('draft','pending_approval','approved','returned','rejected','sent','accepted','declined','changes_requested','expired');
CREATE TYPE public.work_order_status AS ENUM ('not_started','reviewing_files','programming','internal_questions','customer_clarification','simulation','revision_required','approved','released','completed');
CREATE TYPE public.rfq_file_kind AS ENUM ('model_3d','drawing','supporting','cam','nc_program','simulation_report','quote_document');

-- HELPER: internal staff check reused by policies
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _user_id = public.current_user_id()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ironiq_admin','consultant','facility_manager'));
$$;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO app_user;

-- ============ LIBRARIES (internal only) ============
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  family text NOT NULL, grade text NOT NULL, form text NOT NULL,
  density_lb_in3 numeric NOT NULL DEFAULT 0.098,
  cost_per_pound numeric NOT NULL DEFAULT 0,
  cost_per_stock_unit numeric,
  waste_factor numeric NOT NULL DEFAULT 0.15,
  machinability_rating numeric NOT NULL DEFAULT 100,
  programming_complexity_factor numeric NOT NULL DEFAULT 1,
  cycle_time_factor numeric NOT NULL DEFAULT 1,
  tool_wear_factor numeric NOT NULL DEFAULT 1,
  preferred_tooling_notes text, supplier text, specialty boolean NOT NULL DEFAULT false,
  effective_date date NOT NULL DEFAULT CURRENT_DATE, active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  cost_per_pound numeric NOT NULL, cost_per_stock_unit numeric, supplier text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE, notes text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  shape text NOT NULL, dimension_a numeric, dimension_b numeric, dimension_c numeric,
  units text NOT NULL DEFAULT 'in', cost_per_unit numeric, supplier text, active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  manufacturer text NOT NULL, model text NOT NULL, machine_type machine_type NOT NULL,
  axis_count integer NOT NULL DEFAULT 3,
  envelope_x numeric, envelope_y numeric, envelope_z numeric,
  max_stock_x numeric, max_stock_y numeric, max_stock_z numeric,
  max_spindle_rpm integer, spindle_power_hp numeric,
  machine_definition text, post_processor text,
  hourly_burden_rate numeric NOT NULL DEFAULT 0, setup_labor_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  capability_type text NOT NULL, value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.machine_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  hourly_burden_rate numeric NOT NULL, setup_labor_rate numeric NOT NULL,
  programming_rate numeric NOT NULL DEFAULT 95, effective_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  tool_number text, description text NOT NULL, tool_type text NOT NULL,
  diameter numeric, flute_count integer, material text, coating text,
  cost numeric NOT NULL DEFAULT 0, expected_life_minutes numeric, supplier text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tool_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0, reorder_point integer NOT NULL DEFAULT 0,
  location text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ RFQ INTAKE ============
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  rfq_number text NOT NULL UNIQUE,
  customer_rfq_number text, title text NOT NULL, contact_name text, contact_email text,
  project_description text, required_date date, rfq_kind rfq_kind NOT NULL DEFAULT 'prototype',
  export_controlled boolean NOT NULL DEFAULT false, itar boolean NOT NULL DEFAULT false, cui boolean NOT NULL DEFAULT false,
  status rfq_status NOT NULL DEFAULT 'new',
  assigned_estimator uuid, assigned_programmer uuid,
  files_use_confirmed boolean NOT NULL DEFAULT false,
  submitted_at timestamptz, notes text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rfq_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  from_status rfq_status, to_status rfq_status NOT NULL, note text,
  changed_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rfq_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  part_number text NOT NULL, revision text, description text,
  quantity integer NOT NULL DEFAULT 1, quantity_breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rfq_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_part_id uuid NOT NULL REFERENCES public.rfq_parts(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_text text, material_grade text, customer_supplied_material boolean NOT NULL DEFAULT false,
  stock_shape text, stock_dim_a numeric, stock_dim_b numeric, stock_dim_c numeric, units text NOT NULL DEFAULT 'in',
  general_tolerance text, critical_tolerances text, surface_finish text, thread_requirements text,
  heat_treatment text, coating text, inspection_level text, material_certification boolean NOT NULL DEFAULT false,
  fai_required boolean NOT NULL DEFAULT false, special_packaging text, notes text,
  requested_machine_type machine_type, customer_required_machine text, preferred_process text,
  existing_fixture boolean NOT NULL DEFAULT false, existing_program boolean NOT NULL DEFAULT false,
  existing_tooling_notes text, target_price numeric, requested_turnaround_days integer,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rfq_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  rfq_part_id uuid REFERENCES public.rfq_parts(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL, storage_path text NOT NULL,
  file_name text NOT NULL, file_extension text NOT NULL, file_size bigint NOT NULL DEFAULT 0,
  file_kind rfq_file_kind NOT NULL DEFAULT 'supporting',
  revision integer NOT NULL DEFAULT 1, superseded boolean NOT NULL DEFAULT false,
  checksum text, upload_status text NOT NULL DEFAULT 'uploaded',
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GEOMETRY ANALYSIS ============
CREATE TABLE public.geometry_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_part_id uuid NOT NULL REFERENCES public.rfq_parts(id) ON DELETE CASCADE,
  rfq_file_id uuid REFERENCES public.rfq_files(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock', provider_version text NOT NULL DEFAULT '0.1.0',
  status text NOT NULL DEFAULT 'pending', requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, result jsonb, warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_review_required boolean NOT NULL DEFAULT false, uncertainty numeric,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.manufacturing_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geometry_analysis_run_id uuid NOT NULL REFERENCES public.geometry_analysis_runs(id) ON DELETE CASCADE,
  feature_type text NOT NULL, count integer NOT NULL DEFAULT 0, detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ESTIMATING ============
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  rfq_part_id uuid NOT NULL REFERENCES public.rfq_parts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  programming_hours numeric NOT NULL DEFAULT 0, setup_count integer NOT NULL DEFAULT 1,
  setup_hours numeric NOT NULL DEFAULT 0, cycle_time_minutes numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0, target_margin numeric NOT NULL DEFAULT 0.35,
  recommended_price numeric NOT NULL DEFAULT 0,
  confidence estimate_confidence NOT NULL DEFAULT 'moderate',
  manual_review_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimator_notes text, status text NOT NULL DEFAULT 'draft',
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  line_key text NOT NULL, label text NOT NULL, category text NOT NULL DEFAULT 'cost',
  calculated_value numeric NOT NULL DEFAULT 0, value numeric NOT NULL DEFAULT 0,
  source text NOT NULL, assumption text,
  overridden boolean NOT NULL DEFAULT false, override_reason text,
  original_value numeric, overridden_by uuid, overridden_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.estimate_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  assumption text NOT NULL, source text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ QUOTES ============
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  quote_number text NOT NULL UNIQUE, revision integer NOT NULL DEFAULT 1,
  status quote_status NOT NULL DEFAULT 'draft',
  unit_price numeric NOT NULL DEFAULT 0, quantity integer NOT NULL DEFAULT 1,
  quantity_breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  nre_charge numeric NOT NULL DEFAULT 0, tooling_charge numeric NOT NULL DEFAULT 0,
  lead_time_days integer, freight_terms text, payment_terms text, expires_on date,
  assumptions text, exclusions text, preliminary boolean NOT NULL DEFAULT false,
  sent_at timestamptz, responded_at timestamptz, customer_response_note text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  revision integer NOT NULL, snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, reason text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  decision text NOT NULL, notes text,
  approver_id uuid, approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ PROGRAMMING ============
CREATE TABLE public.programming_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  rfq_part_id uuid REFERENCES public.rfq_parts(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  work_order_number text NOT NULL UNIQUE,
  priority text NOT NULL DEFAULT 'normal', assigned_programmer uuid, due_date date,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  machine_definition text, post_processor text, required_tooling text,
  approved_model_file_id uuid REFERENCES public.rfq_files(id) ON DELETE SET NULL,
  approved_drawing_file_id uuid REFERENCES public.rfq_files(id) ON DELETE SET NULL,
  approved_material text, approved_stock text,
  estimated_programming_hours numeric NOT NULL DEFAULT 0, actual_programming_hours numeric,
  status work_order_status NOT NULL DEFAULT 'not_started', programmer_notes text,
  programmer_approved_by uuid, programmer_approved_at timestamptz,
  simulation_recorded boolean NOT NULL DEFAULT false, post_processor_confirmed boolean NOT NULL DEFAULT false,
  machine_confirmed boolean NOT NULL DEFAULT false, revision_confirmed boolean NOT NULL DEFAULT false,
  final_approver uuid, final_approved_at timestamptz, released_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.work_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.programming_work_orders(id) ON DELETE CASCADE,
  from_status work_order_status, to_status work_order_status NOT NULL, note text,
  changed_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cam_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.programming_work_orders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'cam-working-files', storage_path text NOT NULL,
  file_name text NOT NULL, file_size bigint NOT NULL DEFAULT 0, checksum text,
  file_kind text NOT NULL DEFAULT 'cam', revision integer NOT NULL DEFAULT 1,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nc_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.programming_work_orders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'nc-programs', storage_path text NOT NULL,
  program_name text NOT NULL, revision integer NOT NULL DEFAULT 1,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL, post_processor text,
  verified boolean NOT NULL DEFAULT false, released boolean NOT NULL DEFAULT false,
  released_by uuid, released_at timestamptz, checksum text, file_size bigint NOT NULL DEFAULT 0,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.simulation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.programming_work_orders(id) ON DELETE CASCADE,
  nc_program_id uuid REFERENCES public.nc_programs(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outcome text NOT NULL, collisions integer NOT NULL DEFAULT 0, gouges integer NOT NULL DEFAULT 0,
  cycle_time_minutes numeric, report_bucket text, report_path text, notes text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ HISTORY ============
CREATE TABLE public.historical_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.programming_work_orders(id) ON DELETE SET NULL,
  part_number text NOT NULL, revision text, machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  programmer_id uuid, complexity_score numeric, completed_on date,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.actual_job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_job_id uuid NOT NULL REFERENCES public.historical_jobs(id) ON DELETE CASCADE,
  estimated_programming_hours numeric, actual_programming_hours numeric,
  estimated_setup_hours numeric, actual_setup_hours numeric,
  estimated_cycle_minutes numeric, actual_cycle_minutes numeric,
  estimated_tooling_cost numeric, actual_tooling_cost numeric,
  quoted_material_cost numeric, actual_material_cost numeric,
  quoted_margin numeric, realized_margin numeric,
  revision_count integer NOT NULL DEFAULT 0, on_time boolean,
  scrap_or_rework text, root_cause_notes text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.materials, public.material_prices, public.stock_catalog, public.machines,
  public.machine_capabilities, public.machine_rates, public.tools, public.tool_inventory,
  public.rfqs, public.rfq_status_history, public.rfq_parts, public.rfq_requirements, public.rfq_files,
  public.geometry_analysis_runs, public.manufacturing_features,
  public.estimates, public.estimate_line_items, public.estimate_assumptions,
  public.quotes, public.quote_revisions, public.quote_approvals,
  public.programming_work_orders, public.work_order_status_history, public.cam_files,
  public.nc_programs, public.simulation_results, public.historical_jobs, public.actual_job_results
TO app_user;
GRANT ALL ON
  public.materials, public.material_prices, public.stock_catalog, public.machines,
  public.machine_capabilities, public.machine_rates, public.tools, public.tool_inventory,
  public.rfqs, public.rfq_status_history, public.rfq_parts, public.rfq_requirements, public.rfq_files,
  public.geometry_analysis_runs, public.manufacturing_features,
  public.estimates, public.estimate_line_items, public.estimate_assumptions,
  public.quotes, public.quote_revisions, public.quote_approvals,
  public.programming_work_orders, public.work_order_status_history, public.cam_files,
  public.nc_programs, public.simulation_results, public.historical_jobs, public.actual_job_results
TO app_admin;

-- ============ RLS ============
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geometry_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programming_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cam_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actual_job_results ENABLE ROW LEVEL SECURITY;

-- Internal-only tables (cost, rate, CAM, NC, estimating internals)
CREATE POLICY "internal_manage_materials" ON public.materials FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_material_prices" ON public.material_prices FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_stock_catalog" ON public.stock_catalog FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_machines" ON public.machines FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_machine_capabilities" ON public.machine_capabilities FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_machine_rates" ON public.machine_rates FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_tools" ON public.tools FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_tool_inventory" ON public.tool_inventory FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_estimates" ON public.estimates FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_estimate_line_items" ON public.estimate_line_items FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_estimate_assumptions" ON public.estimate_assumptions FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_quote_approvals" ON public.quote_approvals FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_quote_revisions" ON public.quote_revisions FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_cam_files" ON public.cam_files FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_nc_programs" ON public.nc_programs FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_simulation_results" ON public.simulation_results FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_geometry_runs" ON public.geometry_analysis_runs FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_features" ON public.manufacturing_features FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_historical_jobs" ON public.historical_jobs FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_actual_results" ON public.actual_job_results FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_manage_wo_history" ON public.work_order_status_history FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));

-- Org-scoped tables (customers see their own)
CREATE POLICY "org_read_rfqs" ON public.rfqs FOR SELECT TO app_user USING (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "org_write_rfqs" ON public.rfqs FOR ALL TO app_user USING (public.has_org_access(public.current_user_id(), organization_id)) WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "org_rfq_parts" ON public.rfq_parts FOR ALL TO app_user USING (public.has_org_access(public.current_user_id(), organization_id)) WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "org_rfq_files" ON public.rfq_files FOR ALL TO app_user USING (public.has_org_access(public.current_user_id(), organization_id)) WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "org_rfq_requirements" ON public.rfq_requirements FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.rfq_parts p WHERE p.id = rfq_part_id AND public.has_org_access(public.current_user_id(), p.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfq_parts p WHERE p.id = rfq_part_id AND public.has_org_access(public.current_user_id(), p.organization_id)));
CREATE POLICY "org_rfq_status_history" ON public.rfq_status_history FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND public.has_org_access(public.current_user_id(), r.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND public.has_org_access(public.current_user_id(), r.organization_id)));
CREATE POLICY "org_quotes_read" ON public.quotes FOR SELECT TO app_user USING (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "internal_quotes_write" ON public.quotes FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));
CREATE POLICY "org_work_orders_read" ON public.programming_work_orders FOR SELECT TO app_user USING (public.is_internal_user(public.current_user_id()));
CREATE POLICY "internal_work_orders_write" ON public.programming_work_orders FOR ALL TO app_user USING (public.is_internal_user(public.current_user_id())) WITH CHECK (public.is_internal_user(public.current_user_id()));

-- updated_at triggers
CREATE TRIGGER t_materials_upd BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_machines_upd BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_tools_upd BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_rfqs_upd BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_rfq_parts_upd BEFORE UPDATE ON public.rfq_parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_rfq_req_upd BEFORE UPDATE ON public.rfq_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_rfq_files_upd BEFORE UPDATE ON public.rfq_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_estimates_upd BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_estimate_items_upd BEFORE UPDATE ON public.estimate_line_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_quotes_upd BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_wo_upd BEFORE UPDATE ON public.programming_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_nc_upd BEFORE UPDATE ON public.nc_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_geo_upd BEFORE UPDATE ON public.geometry_analysis_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_hist_upd BEFORE UPDATE ON public.historical_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_actual_upd BEFORE UPDATE ON public.actual_job_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_stock_upd BEFORE UPDATE ON public.stock_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_toolinv_upd BEFORE UPDATE ON public.tool_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Number generators
CREATE OR REPLACE FUNCTION public.next_rfq_number() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT 'RFQ-' || to_char(now(),'YYYY') || '-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(rfq_number,'^.*-',''),'')::int),0)+1)::text,4,'0')
  FROM public.rfqs WHERE rfq_number LIKE 'RFQ-' || to_char(now(),'YYYY') || '-%';
$$;
CREATE OR REPLACE FUNCTION public.next_quote_number() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT 'QT-' || to_char(now(),'YYYY') || '-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(quote_number,'^.*-',''),'')::int),0)+1)::text,4,'0')
  FROM public.quotes WHERE quote_number LIKE 'QT-' || to_char(now(),'YYYY') || '-%';
$$;
CREATE OR REPLACE FUNCTION public.next_work_order_number() RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT 'WO-' || to_char(now(),'YYYY') || '-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(work_order_number,'^.*-',''),'')::int),0)+1)::text,4,'0')
  FROM public.programming_work_orders WHERE work_order_number LIKE 'WO-' || to_char(now(),'YYYY') || '-%';
$$;
REVOKE EXECUTE ON FUNCTION public.next_rfq_number(), public.next_quote_number(), public.next_work_order_number() FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_rfq_number(), public.next_quote_number(), public.next_work_order_number() TO app_user;-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]



-- ============ ENUMS ============
CREATE TYPE public.job_status AS ENUM (
  'customer_submission_draft','customer_data_submitted','iss_intake_review','missing_information',
  'digital_data_recovery_required','machine_profile_review','tooling_review_required','fixture_review_required',
  'ready_for_ai_planning','ai_manufacturing_plan_in_progress','ai_manufacturing_plan_generated',
  'programmer_plan_review','manufacturing_plan_approved','mastercam_integration_pending','mastercam_job_created',
  'toolpath_generation_in_progress','preliminary_toolpaths_generated','automated_checks_in_progress',
  'corrections_required','ready_for_simulation','simulation_in_progress','simulation_failed',
  'simulation_passed_with_warnings','simulation_passed','programmer_approval_pending',
  'programmer_revisions_in_progress','programmer_approved','posting_in_progress','posted_code_review',
  'setup_sheet_generation','final_technical_review','ready_for_customer_release','released_to_customer',
  'customer_prove_out','revision_requested','completed'
);
CREATE TYPE public.check_severity AS ENUM ('critical','review_required','advisory','passed');
CREATE TYPE public.complexity_level AS ENUM ('low','moderate','high','very_high');
CREATE TYPE public.exception_kind AS ENUM ('missing_customer_information','digital_data_recovery','unsupported_machine_or_controller','tooling_gap','fixture_gap');
CREATE TYPE public.exception_status AS ENUM ('pending','approved','denied');
CREATE TYPE public.intake_result AS ENUM ('ready_for_ai_planning','human_intake_review_required','missing_customer_information','tooling_review_required','fixture_review_required','digital_data_recovery_required','unsupported_machine_or_controller','manual_programming_required');
CREATE TYPE public.integration_mode AS ENUM ('direct_automation','guided_add_in','structured_package');
CREATE TYPE public.recommendation_decision AS ENUM ('accepted','modified','rejected','not_applicable');
CREATE TYPE public.simulation_status AS ENUM ('not_simulated','simulation_in_progress','simulation_failed','corrections_required','simulation_passed_with_warnings','simulation_passed','human_verification_required');

-- ============ REFERENCE TABLES ============
CREATE TABLE public.machine_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, make text NOT NULL, model text NOT NULL, controller text NOT NULL,
  axis_count int NOT NULL DEFAULT 3,
  travel_x numeric, travel_y numeric, travel_z numeric,
  max_spindle_rpm numeric, max_feed_rate numeric,
  rotary_limits text, known_limitations text,
  post_processors text[] NOT NULL DEFAULT '{}',
  is_supported boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_profiles TO app_user;
GRANT ALL ON public.machine_profiles TO app_admin;
ALTER TABLE public.machine_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tooling_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  description text NOT NULL, tool_type text NOT NULL,
  tool_number int, diameter numeric, corner_radius numeric, flute_count int,
  material text, holder text, overall_length numeric, stick_out numeric,
  notes text, is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tooling_profiles TO app_user;
GRANT ALL ON public.tooling_profiles TO app_admin;
ALTER TABLE public.tooling_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, controller text NOT NULL, machine_family text,
  version text NOT NULL DEFAULT '1.0', notes text,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_processors TO app_user;
GRANT ALL ON public.post_processors TO app_admin;
ALTER TABLE public.post_processors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.programmer_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programmer_id uuid NOT NULL UNIQUE,
  machine_makes text[] NOT NULL DEFAULT '{}',
  machine_models text[] NOT NULL DEFAULT '{}',
  controllers text[] NOT NULL DEFAULT '{}',
  max_complexity public.complexity_level NOT NULL DEFAULT 'moderate',
  max_active_jobs int NOT NULL DEFAULT 5,
  available boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programmer_capabilities TO app_user;
GRANT ALL ON public.programmer_capabilities TO app_admin;
ALTER TABLE public.programmer_capabilities ENABLE ROW LEVEL SECURITY;

-- reference RLS: read for signed-in users, write for platform staff
CREATE POLICY "machine_profiles read" ON public.machine_profiles FOR SELECT TO app_user USING (true);
CREATE POLICY "machine_profiles manage" ON public.machine_profiles FOR ALL TO app_user
  USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "tooling_profiles read" ON public.tooling_profiles FOR SELECT TO app_user USING (true);
CREATE POLICY "tooling_profiles manage" ON public.tooling_profiles FOR ALL TO app_user
  USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "post_processors read" ON public.post_processors FOR SELECT TO app_user USING (true);
CREATE POLICY "post_processors manage" ON public.post_processors FOR ALL TO app_user
  USING (public.is_platform_staff(public.current_user_id())) WITH CHECK (public.is_platform_staff(public.current_user_id()));
CREATE POLICY "capabilities read" ON public.programmer_capabilities FOR SELECT TO app_user
  USING (public.is_platform_staff(public.current_user_id()) OR programmer_id = public.current_user_id());
CREATE POLICY "capabilities manage" ON public.programmer_capabilities FOR ALL TO app_user
  USING (public.is_platform_staff(public.current_user_id()) OR programmer_id = public.current_user_id())
  WITH CHECK (public.is_platform_staff(public.current_user_id()) OR programmer_id = public.current_user_id());

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  job_number text NOT NULL,
  customer_job_number text,
  status public.job_status NOT NULL DEFAULT 'customer_submission_draft',
  part_number text, part_name text, part_revision text,
  machine_make text, machine_model text, controller text, axis_count int,
  machine_profile_id uuid REFERENCES public.machine_profiles(id) ON DELETE SET NULL,
  material_spec text, stock_type text,
  stock_length numeric, stock_width numeric, stock_thickness numeric, stock_diameter numeric,
  workholding_method text, fixture_restrictions text, available_tooling text,
  critical_dimensions text, geometric_tolerances text, surface_finish_requirements text,
  inspection_requirements text, quantity int, requested_turnaround text,
  special_instructions text,
  integration_mode public.integration_mode,
  assigned_programmer uuid,
  exception_reason text, exception_approved_by uuid,
  submitted_at timestamptz, released_at timestamptz, released_by uuid,
  created_by uuid NOT NULL DEFAULT public.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO app_user;
GRANT ALL ON public.jobs TO app_admin;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_job_number()
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT 'JOB-' || to_char(now(),'YYYY') || '-' ||
    lpad((COALESCE(MAX(NULLIF(regexp_replace(job_number,'^.*-',''),'')::int),0)+1)::text,4,'0')
  FROM public.jobs WHERE job_number LIKE 'JOB-' || to_char(now(),'YYYY') || '-%';
$$;
ALTER TABLE public.jobs ALTER COLUMN job_number SET DEFAULT public.next_job_number();

CREATE OR REPLACE FUNCTION public.can_read_job(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_id() IS NOT NULL AND (
    public.is_platform_staff(public.current_user_id())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = public.current_user_id()
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_job(uuid) FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_job(uuid) TO app_user, app_admin;

CREATE POLICY "jobs read" ON public.jobs FOR SELECT TO app_user
  USING (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "jobs insert" ON public.jobs FOR INSERT TO app_user
  WITH CHECK (public.has_org_access(public.current_user_id(), organization_id) AND created_by = public.current_user_id());
CREATE POLICY "jobs update" ON public.jobs FOR UPDATE TO app_user
  USING (public.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));
CREATE POLICY "jobs delete" ON public.jobs FOR DELETE TO app_user
  USING (public.is_platform_staff(public.current_user_id()));

-- ============ CHILD TABLES ============
CREATE TABLE public.job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL, file_kind text NOT NULL DEFAULT 'other',
  file_size bigint, storage_path text NOT NULL, notes text,
  uploaded_by uuid NOT NULL DEFAULT public.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.intake_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags text[] NOT NULL DEFAULT '{}',
  complexity public.complexity_level,
  result public.intake_result,
  ai_suitable boolean NOT NULL DEFAULT true,
  notes text, reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.intake_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  kind public.exception_kind NOT NULL,
  status public.exception_status NOT NULL DEFAULT 'pending',
  request_reason text NOT NULL, missing_items text, proposed_path text,
  resume_status public.job_status,
  requested_by uuid, requested_by_name text,
  decided_by uuid, decided_by_name text, decided_at timestamptz, decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Preliminary — Programmer Review Required',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text, generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_recommendation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  ai_plan_id uuid REFERENCES public.ai_plans(id) ON DELETE SET NULL,
  recommendation_key text NOT NULL, recommendation_label text NOT NULL,
  ai_value text, programmer_value text,
  decision public.recommendation_decision NOT NULL DEFAULT 'accepted',
  reason_code text, reason_notes text,
  decided_by uuid, decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.plan_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  ai_plan_id uuid REFERENCES public.ai_plans(id) ON DELETE SET NULL,
  action text NOT NULL, changes text, change_reason text,
  programmer_instructions text,
  approved_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer uuid, reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  setup_number int NOT NULL DEFAULT 1,
  sequence int NOT NULL DEFAULT 1,
  operation_type text NOT NULL, name text, description text, feature text,
  tool_id uuid REFERENCES public.tooling_profiles(id) ON DELETE SET NULL,
  tool_number int, tool_description text, holder text,
  spindle_rpm numeric, feed_rate numeric, step_over numeric, step_down numeric,
  stock_to_leave numeric, tolerance numeric, clearance numeric,
  coolant text, entry_method text, exit_method text, linking_parameters text,
  work_offset text, customer_requirement text,
  source text NOT NULL DEFAULT 'ai',
  validated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mastercam_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mode public.integration_mode NOT NULL DEFAULT 'structured_package',
  state text NOT NULL DEFAULT 'pending',
  file_name text, file_version text, mastercam_version text,
  machine_definition text,
  post_processor_id uuid REFERENCES public.post_processors(id) ON DELETE SET NULL,
  package jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text, last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.automated_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  check_key text NOT NULL, check_label text NOT NULL,
  severity public.check_severity NOT NULL DEFAULT 'passed',
  detail text, resolved boolean NOT NULL DEFAULT false,
  run_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.simulation_status NOT NULL DEFAULT 'not_simulated',
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  collisions text, warnings text, corrective_actions text,
  estimated_cycle_time numeric,
  software_version text, mastercam_version text, machine_definition_version text,
  post_processor_version text, program_version text,
  simulated_by uuid, simulated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.programmer_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  program_version text, mastercam_file_version text,
  simulation_status public.simulation_status,
  notes text,
  programmer uuid NOT NULL, programmer_name text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.post_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  post_processor_id uuid REFERENCES public.post_processors(id) ON DELETE SET NULL,
  post_processor_name text, post_processor_version text,
  machine_definition text, control_definition text, mastercam_version text,
  program_number text, program_revision text,
  expected_tool_numbers text, expected_work_offsets text,
  code_text text,
  code_review jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending',
  posted_by uuid, posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.setup_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  reviewer uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.release_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contents jsonb NOT NULL DEFAULT '{}'::jsonb,
  license_text text,
  released boolean NOT NULL DEFAULT false,
  released_by uuid, released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prove_out_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  first_piece_accepted boolean,
  dimensional_results text, surface_finish_results text, tool_life_results text,
  planned_cycle_time numeric, simulated_cycle_time numeric, actual_cycle_time numeric,
  planned_tooling text, actual_tooling text,
  setup_changes text, fixture_changes text, offset_changes text,
  feed_speed_changes text, program_changes text, clearance_concerns text,
  operator_feedback text, programmer_feedback text,
  revision_required boolean NOT NULL DEFAULT false, revision_reason text,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- grants + RLS for every job child table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_files','intake_reviews','intake_exceptions','ai_plans',
    'ai_recommendation_decisions','plan_reviews','operations','mastercam_jobs','automated_checks',
    'simulations','programmer_approvals','post_records','setup_sheets','release_packages','prove_out_results']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
    EXECUTE format('GRANT ALL ON public.%I TO app_admin', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%1$s access" ON public.%1$I FOR ALL TO app_user
      USING (public.can_read_job(job_id)) WITH CHECK (public.can_read_job(job_id))$p$, t);
  END LOOP;
END $$;

-- ============ PROGRAMMER AUTO-ASSIGNMENT ============
CREATE OR REPLACE FUNCTION public.complexity_rank(_c public.complexity_level)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _c WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.select_programmer_for_job(_job_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH j AS (SELECT * FROM public.jobs WHERE id = _job_id),
  cx AS (SELECT COALESCE((SELECT complexity FROM public.intake_reviews WHERE job_id = _job_id ORDER BY created_at DESC LIMIT 1),'moderate'::public.complexity_level) AS lvl)
  SELECT c.programmer_id
    FROM public.programmer_capabilities c, j, cx
   WHERE c.available
     AND public.complexity_rank(c.max_complexity) >= public.complexity_rank(cx.lvl)
     AND (j.machine_make IS NULL OR cardinality(c.machine_makes) = 0 OR j.machine_make = ANY (c.machine_makes))
     AND (j.controller IS NULL OR cardinality(c.controllers) = 0 OR j.controller = ANY (c.controllers))
     AND (SELECT count(*) FROM public.jobs a WHERE a.assigned_programmer = c.programmer_id
            AND a.status NOT IN ('completed','released_to_customer')) < c.max_active_jobs
   ORDER BY public.complexity_rank(c.max_complexity) ASC,
            (SELECT count(*) FROM public.jobs a WHERE a.assigned_programmer = c.programmer_id) ASC
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.select_programmer_for_job(uuid) FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_programmer_for_job(uuid) TO app_user, app_admin;
REVOKE EXECUTE ON FUNCTION public.complexity_rank(public.complexity_level) FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complexity_rank(public.complexity_level) TO app_user, app_admin;
REVOKE EXECUTE ON FUNCTION public.next_job_number() FROM app_anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_job_number() TO app_user, app_admin;

CREATE OR REPLACE FUNCTION public.auto_assign_programmer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_programmer IS NULL
     AND NEW.status <> 'customer_submission_draft'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.assigned_programmer := public.select_programmer_for_job(NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER jobs_auto_assign_programmer BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_programmer();

-- updated_at triggers
CREATE TRIGGER t_jobs_upd BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_machine_profiles_upd BEFORE UPDATE ON public.machine_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_tooling_profiles_upd BEFORE UPDATE ON public.tooling_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_post_processors_upd BEFORE UPDATE ON public.post_processors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_prog_caps_upd BEFORE UPDATE ON public.programmer_capabilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_intake_reviews_upd BEFORE UPDATE ON public.intake_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_intake_exceptions_upd BEFORE UPDATE ON public.intake_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_operations_upd BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_mastercam_jobs_upd BEFORE UPDATE ON public.mastercam_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_setup_sheets_upd BEFORE UPDATE ON public.setup_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_release_packages_upd BEFORE UPDATE ON public.release_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- indexes
CREATE INDEX idx_jobs_org ON public.jobs(organization_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_operations_job ON public.operations(job_id, setup_number, sequence);
CREATE INDEX idx_job_files_job ON public.job_files(job_id);

-- ============ STORAGE POLICIES (bucket created separately) ============
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]
-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]REVOKE EXECUTE ON FUNCTION public.auto_assign_programmer() FROM app_anon, app_user, PUBLIC;-- New roles
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
GRANT SELECT ON public.cap_domains TO app_user;
GRANT ALL ON public.cap_domains TO app_admin;
ALTER TABLE public.cap_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_domains readable" ON public.cap_domains FOR SELECT TO app_user USING (public.current_user_id() IS NOT NULL);

CREATE TABLE public.cap_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.cap_domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cap_criteria TO app_user;
GRANT ALL ON public.cap_criteria TO app_admin;
ALTER TABLE public.cap_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_criteria readable" ON public.cap_criteria FOR SELECT TO app_user USING (public.current_user_id() IS NOT NULL);

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_assessments TO app_user;
GRANT ALL ON public.cap_assessments TO app_admin;
ALTER TABLE public.cap_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_assessments org access" ON public.cap_assessments FOR ALL TO app_user
  USING (public.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (public.has_org_access(public.current_user_id(), organization_id));

CREATE OR REPLACE FUNCTION public.cap_can_access(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cap_assessments a
    WHERE a.id = _assessment_id AND public.has_org_access(public.current_user_id(), a.organization_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.cap_can_access(uuid) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.cap_can_access(uuid) TO app_user;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_problems TO app_user;
GRANT ALL ON public.cap_problems TO app_admin;
ALTER TABLE public.cap_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_problems access" ON public.cap_problems FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_performance_impacts TO app_user;
GRANT ALL ON public.cap_performance_impacts TO app_admin;
ALTER TABLE public.cap_performance_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_impacts access" ON public.cap_performance_impacts FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_scores TO app_user;
GRANT ALL ON public.cap_scores TO app_admin;
ALTER TABLE public.cap_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_scores access" ON public.cap_scores FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_findings TO app_user;
GRANT ALL ON public.cap_findings TO app_admin;
ALTER TABLE public.cap_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_findings access" ON public.cap_findings FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_evidence TO app_user;
GRANT ALL ON public.cap_evidence TO app_admin;
ALTER TABLE public.cap_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_evidence access" ON public.cap_evidence FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_finding_links TO app_user;
GRANT ALL ON public.cap_finding_links TO app_admin;
ALTER TABLE public.cap_finding_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_links access" ON public.cap_finding_links FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_root_gaps TO app_user;
GRANT ALL ON public.cap_root_gaps TO app_admin;
ALTER TABLE public.cap_root_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_gaps access" ON public.cap_root_gaps FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_actions TO app_user;
GRANT ALL ON public.cap_actions TO app_admin;
ALTER TABLE public.cap_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_actions access" ON public.cap_actions FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_results TO app_user;
GRANT ALL ON public.cap_results TO app_admin;
ALTER TABLE public.cap_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_results access" ON public.cap_results FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_validations TO app_user;
GRANT ALL ON public.cap_validations TO app_admin;
ALTER TABLE public.cap_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_validations access" ON public.cap_validations FOR ALL TO app_user
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_reports TO app_user;
GRANT ALL ON public.cap_reports TO app_admin;
ALTER TABLE public.cap_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cap_reports access" ON public.cap_reports FOR ALL TO app_user
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
) AS c(domain_code, name, ord) ON c.domain_code = d.code;-- 1. Performance metrics (Step 2)
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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
    EXECUTE format('GRANT ALL ON public.%I TO app_admin', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO app_user USING (public.cap_can_access(assessment_id)) WITH CHECK (public.cap_can_access(assessment_id))',
      t || '_org_access', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      't_' || t || '_upd', t);
  END LOOP;
END $$;

CREATE INDEX ON public.cap_metrics (assessment_id);
CREATE INDEX ON public.cap_observations (assessment_id);
CREATE INDEX ON public.cap_chain_nodes (assessment_id);-- 1. Programmer auto-assignment is only ever needed inside the jobs trigger,
--    which runs as the definer owner. No client role should be able to call it.
REVOKE ALL ON FUNCTION public.select_programmer_for_job(uuid) FROM PUBLIC, app_anon, app_user;
REVOKE ALL ON FUNCTION public.complexity_rank(public.complexity_level) FROM PUBLIC, app_anon;

-- 2. The remaining SECURITY DEFINER functions are RLS helpers: Postgres evaluates
--    policy expressions as the querying role, so `app_user` must retain
--    EXECUTE or every policy that references them fails closed. Remove any
--    broader PUBLIC/app_anon grant and re-assert the minimal grant explicitly.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.has_org_access(uuid, uuid)',
    'public.has_facility_access(uuid, uuid)',
    'public.is_platform_staff(uuid)',
    'public.is_internal_user(uuid)',
    'public.can_read_job(uuid)',
    'public.can_edit_template(uuid)',
    'public.cap_can_access(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, app_anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_user', fn);
  END LOOP;
END $$;

-- 3. Defence in depth: these helpers already refuse to answer for any user other
--    than the caller. Re-assert that guard on the two that gate job/template
--    access so a signed-in user cannot probe another tenant's rows.
CREATE OR REPLACE FUNCTION public.can_read_job(_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.current_user_id() IS NOT NULL AND (
    public.is_platform_staff(public.current_user_id())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = public.current_user_id()
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_read_job(uuid) FROM PUBLIC, app_anon;
GRANT EXECUTE ON FUNCTION public.can_read_job(uuid) TO app_user;
-- Private schema is not exposed through the Data API, so nothing in it is
-- callable by app_anon/app_user over PostgREST.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO app_user, app_admin;

-- Functions that call the helpers must resolve them in the new schema.
ALTER FUNCTION public.has_org_access(uuid, uuid)            SET search_path TO 'private', 'public';
ALTER FUNCTION public.has_facility_access(uuid, uuid)       SET search_path TO 'private', 'public';
ALTER FUNCTION public.can_read_job(uuid)                    SET search_path TO 'private', 'public';
ALTER FUNCTION public.can_edit_template(uuid)               SET search_path TO 'private', 'public';
ALTER FUNCTION public.cap_can_access(uuid)                  SET search_path TO 'private', 'public';
ALTER FUNCTION public.clone_template_version(uuid, text)    SET search_path TO 'private', 'public';
ALTER FUNCTION public.publish_template_version(uuid)        SET search_path TO 'private', 'public';

-- Drop the hard-coded public.* prefixes so the helpers resolve after the move.
CREATE OR REPLACE FUNCTION public.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT _user_id IS NOT NULL AND _user_id = public.current_user_id()
     AND (
       is_platform_staff(_user_id)
       OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = _user_id AND m.organization_id = _org_id)
     );
$fn$;

CREATE OR REPLACE FUNCTION public.has_facility_access(_user_id uuid, _facility_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT _user_id IS NOT NULL AND _user_id = public.current_user_id()
     AND (
       is_platform_staff(_user_id)
       OR EXISTS (
         SELECT 1 FROM public.facilities f
         JOIN public.organization_members m ON m.organization_id = f.organization_id
         WHERE f.id = _facility_id AND m.user_id = _user_id
       )
     );
$fn$;

CREATE OR REPLACE FUNCTION public.can_read_job(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT public.current_user_id() IS NOT NULL AND (
    is_platform_staff(public.current_user_id())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = public.current_user_id()
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.can_edit_template(_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT public.current_user_id() IS NOT NULL
     AND (
       is_platform_staff(public.current_user_id())
       OR EXISTS (
         SELECT 1
         FROM public.assessment_templates t
         JOIN public.organization_members m ON m.organization_id = t.owner_organization_id
         WHERE t.id = _template_id
           AND m.user_id = public.current_user_id()
           AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = public.current_user_id() AND r.role = 'customer_admin')
       )
     );
$fn$;

CREATE OR REPLACE FUNCTION public.cap_can_access(_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'private', 'public' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.cap_assessments a
    WHERE a.id = _assessment_id AND has_org_access(public.current_user_id(), a.organization_id)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.clone_template_version(_version_id uuid, _notes text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SET search_path TO 'private', 'public' AS $fn$
DECLARE src record; new_version int; new_id uuid; cat record; new_cat uuid;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to create versions of this template.';
  END IF;

  SELECT COALESCE(MAX(version),0) + 1 INTO new_version
    FROM public.assessment_template_versions WHERE template_id = src.template_id;

  INSERT INTO public.assessment_template_versions (template_id, version, status, notes)
  VALUES (src.template_id, new_version, 'draft', COALESCE(_notes, 'Draft copied from v' || src.version))
  RETURNING id INTO new_id;

  FOR cat IN SELECT * FROM public.assessment_categories WHERE template_version_id = _version_id ORDER BY sort_order LOOP
    INSERT INTO public.assessment_categories (template_version_id, code, name, description, weight, sort_order, archived)
    VALUES (new_id, cat.code, cat.name, cat.description, cat.weight, cat.sort_order, cat.archived)
    RETURNING id INTO new_cat;

    INSERT INTO public.assessment_questions
      (category_id, question_code, question_text, guidance_text, weight, is_critical, required_evidence,
       sort_order, is_required, allow_not_applicable, auto_finding, default_severity, archived)
    SELECT new_cat, q.question_code, q.question_text, q.guidance_text, q.weight, q.is_critical, q.required_evidence,
           q.sort_order, q.is_required, q.allow_not_applicable, q.auto_finding, q.default_severity, q.archived
      FROM public.assessment_questions q WHERE q.category_id = cat.id ORDER BY q.sort_order;
  END LOOP;

  RETURN new_id;
END; $fn$;

CREATE OR REPLACE FUNCTION public.publish_template_version(_version_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'private', 'public' AS $fn$
DECLARE src record; total numeric; cat_count int; bad int;
BEGIN
  SELECT * INTO src FROM public.assessment_template_versions WHERE id = _version_id;
  IF src IS NULL THEN RAISE EXCEPTION 'Template version not found.'; END IF;
  IF NOT can_edit_template(src.template_id) THEN
    RAISE EXCEPTION 'You are not permitted to publish this template.';
  END IF;
  IF src.status <> 'draft' THEN RAISE EXCEPTION 'Only draft versions can be published.'; END IF;

  SELECT COALESCE(SUM(weight),0), count(*) INTO total, cat_count
    FROM public.assessment_categories WHERE template_version_id = _version_id AND archived = false;
  IF cat_count = 0 THEN RAISE EXCEPTION 'Add at least one category before publishing.'; END IF;
  IF round(total,2) <> 100.00 THEN RAISE EXCEPTION 'Category weights must total exactly 100%% (currently %).', round(total,2); END IF;

  SELECT count(*) INTO bad FROM public.assessment_categories c
   WHERE c.template_version_id = _version_id AND c.archived = false
     AND NOT EXISTS (SELECT 1 FROM public.assessment_questions q WHERE q.category_id = c.id AND q.archived = false);
  IF bad > 0 THEN RAISE EXCEPTION 'Every category must contain at least one active question.'; END IF;

  SELECT count(*) INTO bad FROM public.assessment_questions q
    JOIN public.assessment_categories c ON c.id = q.category_id
   WHERE c.template_version_id = _version_id AND q.archived = false
     AND (q.weight <= 0 OR btrim(q.question_text) = '' OR btrim(q.question_code) = '');
  IF bad > 0 THEN RAISE EXCEPTION 'All active questions need an ID, text and a weight greater than zero.'; END IF;

  UPDATE public.assessment_template_versions
     SET status = 'published', published_at = now(), published_by = public.current_user_id(), updated_at = now()
   WHERE id = _version_id;

  UPDATE public.assessment_templates
     SET status = 'published', updated_at = now(), updated_by = public.current_user_id()
   WHERE id = src.template_id AND status = 'draft';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (public.current_user_id(), 'template_version_published', 'assessment_template_version', _version_id,
          jsonb_build_object('template_id', src.template_id, 'version', src.version));
END; $fn$;

-- Now relocate the helpers themselves. Existing RLS policies reference them by
-- OID, so they keep working without any policy rewrite.
ALTER FUNCTION public.has_role(uuid, public.app_role)       SET SCHEMA private;
ALTER FUNCTION public.has_org_access(uuid, uuid)            SET SCHEMA private;
ALTER FUNCTION public.has_facility_access(uuid, uuid)       SET SCHEMA private;
ALTER FUNCTION public.is_platform_staff(uuid)               SET SCHEMA private;
ALTER FUNCTION public.is_internal_user(uuid)                SET SCHEMA private;
ALTER FUNCTION public.can_read_job(uuid)                    SET SCHEMA private;
ALTER FUNCTION public.can_edit_template(uuid)               SET SCHEMA private;
ALTER FUNCTION public.cap_can_access(uuid)                  SET SCHEMA private;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, app_anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO app_user, app_admin;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_assessments TO app_user;
GRANT ALL ON public.field_assessments TO app_admin;
ALTER TABLE public.field_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_assessments org access" ON public.field_assessments
  FOR ALL TO app_user
  USING (private.has_org_access(public.current_user_id(), organization_id))
  WITH CHECK (private.has_org_access(public.current_user_id(), organization_id));

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_assessment_ratings TO app_user;
GRANT ALL ON public.field_assessment_ratings TO app_admin;
ALTER TABLE public.field_assessment_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_assessment_ratings org access" ON public.field_assessment_ratings
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a
                 WHERE a.id = field_assessment_id
                   AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a
                 WHERE a.id = field_assessment_id
                   AND private.has_org_access(public.current_user_id(), a.organization_id)));

CREATE TRIGGER t_field_assessment_ratings_upd BEFORE UPDATE ON public.field_assessment_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_field_assessments_org ON public.field_assessments(organization_id, observed_at DESC);
CREATE INDEX idx_field_ratings_assessment ON public.field_assessment_ratings(field_assessment_id);ALTER TABLE public.field_assessments
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_observations TO app_user;
GRANT ALL ON public.field_observations TO app_admin;
ALTER TABLE public.field_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_observations org access" ON public.field_observations
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_gaps TO app_user;
GRANT ALL ON public.field_gaps TO app_admin;
ALTER TABLE public.field_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_gaps org access" ON public.field_gaps
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_constraints TO app_user;
GRANT ALL ON public.field_constraints TO app_admin;
ALTER TABLE public.field_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_constraints org access" ON public.field_constraints
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_opportunities TO app_user;
GRANT ALL ON public.field_opportunities TO app_admin;
ALTER TABLE public.field_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_opportunities org access" ON public.field_opportunities
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
CREATE TRIGGER t_field_opportunities_upd BEFORE UPDATE ON public.field_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_field_opportunities_assessment ON public.field_opportunities(field_assessment_id);
ALTER TABLE public.field_assessments
  ADD COLUMN IF NOT EXISTS facility_name text,
  ADD COLUMN IF NOT EXISTS facility_location text,
  ADD COLUMN IF NOT EXISTS assessment_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS client_contact text,
  ADD COLUMN IF NOT EXISTS client_contact_title text,
  ADD COLUMN IF NOT EXISTS assessment_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS problem_department text,
  ADD COLUMN IF NOT EXISTS problem_machine text,
  ADD COLUMN IF NOT EXISTS problem_cell text,
  ADD COLUMN IF NOT EXISTS impact_notes text,
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS preliminary_conclusion text;

CREATE TABLE IF NOT EXISTS public.field_capture_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  domain_code text NOT NULL,
  category text,
  area text,
  machine text,
  production_cell text,
  process text,
  observed_condition text,
  objective_evidence text,
  assessor_notes text,
  context_source text,
  rating integer,
  not_observed boolean NOT NULL DEFAULT false,
  evidence_class text NOT NULL DEFAULT 'Observed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_capture_observations TO app_user;
GRANT ALL ON public.field_capture_observations TO app_admin;
ALTER TABLE public.field_capture_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_capture_observations org access" ON public.field_capture_observations
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
CREATE TRIGGER t_field_capture_obs_upd BEFORE UPDATE ON public.field_capture_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_fco_assessment ON public.field_capture_observations(field_assessment_id);

CREATE TABLE IF NOT EXISTS public.field_quick_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  note text,
  area text,
  machine text,
  domain_code text,
  potential_problem text,
  converted_observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_quick_captures TO app_user;
GRANT ALL ON public.field_quick_captures TO app_admin;
ALTER TABLE public.field_quick_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_quick_captures org access" ON public.field_quick_captures
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));
CREATE TRIGGER t_field_quick_captures_upd BEFORE UPDATE ON public.field_quick_captures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.field_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_assessment_id uuid NOT NULL REFERENCES public.field_assessments(id) ON DELETE CASCADE,
  observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE CASCADE,
  gap_id uuid REFERENCES public.field_gaps(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  caption text,
  area text,
  machine text,
  domain_code text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_attachments TO app_user;
GRANT ALL ON public.field_attachments TO app_admin;
ALTER TABLE public.field_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_attachments org access" ON public.field_attachments
  FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_assessment_id AND private.has_org_access(public.current_user_id(), a.organization_id)));

ALTER TABLE public.field_gaps
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS domain_code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS observation_id uuid REFERENCES public.field_capture_observations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_class text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS ironclad_actions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operational_impact text,
  ADD COLUMN IF NOT EXISTS implementation_effort text,
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS ironclad_fit text,
  ADD COLUMN IF NOT EXISTS priority_code text,
  ADD COLUMN IF NOT EXISTS priority_class text,
  ADD COLUMN IF NOT EXISTS is_top_finding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_rating integer;

-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]

-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]

-- [storage.objects policy removed — see MIGRATION_PHASE2.md, moved to app-level authorization]

ALTER TABLE public.field_capture_observations
  ADD COLUMN IF NOT EXISTS focus_area text,
  ADD COLUMN IF NOT EXISTS operational_impact text,
  ADD COLUMN IF NOT EXISTS constrained_capability text,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS ironclad_support text,
  ADD COLUMN IF NOT EXISTS requires_validation boolean NOT NULL DEFAULT false;

ALTER TABLE public.field_gaps
  ADD COLUMN IF NOT EXISTS focus_area text,
  ADD COLUMN IF NOT EXISTS operational_impact_text text,
  ADD COLUMN IF NOT EXISTS preliminary_constraint text,
  ADD COLUMN IF NOT EXISTS validation_needed text,
  ADD COLUMN IF NOT EXISTS ironclad_support text,
  ADD COLUMN IF NOT EXISTS validation_questions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_requirements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_status text,
  ADD COLUMN IF NOT EXISTS client_comments text,
  ADD COLUMN IF NOT EXISTS finding_rank integer,
  ADD COLUMN IF NOT EXISTS opp_service text,
  ADD COLUMN IF NOT EXISTS opp_scope text,
  ADD COLUMN IF NOT EXISTS opp_complexity text,
  ADD COLUMN IF NOT EXISTS opp_revenue text,
  ADD COLUMN IF NOT EXISTS opp_resources text,
  ADD COLUMN IF NOT EXISTS opp_partner text,
  ADD COLUMN IF NOT EXISTS opp_confidence text,
  ADD COLUMN IF NOT EXISTS opp_stage text,
  ADD COLUMN IF NOT EXISTS opp_next_action text;

ALTER TABLE public.field_assessments
  ADD COLUMN IF NOT EXISTS baseline_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_summary text,
  ADD COLUMN IF NOT EXISTS rec_significant_constraints boolean,
  ADD COLUMN IF NOT EXISTS rec_measurable_impact boolean,
  ADD COLUMN IF NOT EXISTS rec_unvalidated boolean,
  ADD COLUMN IF NOT EXISTS rec_deeper_helps boolean,
  ADD COLUMN IF NOT EXISTS rec_in_scope boolean,
  ADD COLUMN IF NOT EXISTS recommended_path text,
  ADD COLUMN IF NOT EXISTS review_meeting_date date,
  ADD COLUMN IF NOT EXISTS review_attendees text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS meeting_new_info text,
  ADD COLUMN IF NOT EXISTS meeting_new_gaps text,
  ADD COLUMN IF NOT EXISTS meeting_data_promised text,
  ADD COLUMN IF NOT EXISTS meeting_scope text,
  ADD COLUMN IF NOT EXISTS meeting_projects text,
  ADD COLUMN IF NOT EXISTS meeting_decision text,
  ADD COLUMN IF NOT EXISTS meeting_next_action text,
  ADD COLUMN IF NOT EXISTS meeting_owner text,
  ADD COLUMN IF NOT EXISTS meeting_target_date date;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'field_assessments','field_capture_observations','field_gaps','field_attachments',
    'field_quick_captures','field_observations','field_constraints','field_opportunities',
    'field_assessment_ratings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' org access', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ironclad staff access', t);
  END LOOP;
END $$;

CREATE POLICY "ironclad staff access" ON public.field_assessments
  FOR ALL TO app_user
  USING (
    private.has_org_access(public.current_user_id(), organization_id)
    AND (private.has_role(public.current_user_id(), 'ironiq_admin') OR private.has_role(public.current_user_id(), 'consultant'))
  )
  WITH CHECK (
    private.has_org_access(public.current_user_id(), organization_id)
    AND (private.has_role(public.current_user_id(), 'ironiq_admin') OR private.has_role(public.current_user_id(), 'consultant'))
  );

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'field_capture_observations','field_gaps','field_attachments','field_quick_captures',
    'field_observations','field_constraints','field_opportunities','field_assessment_ratings'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY "ironclad staff access" ON public.%I
        FOR ALL TO app_user
        USING (EXISTS (SELECT 1 FROM public.field_assessments a
                        WHERE a.id = %I.field_assessment_id
                          AND private.has_org_access(public.current_user_id(), a.organization_id)
                          AND (private.has_role(public.current_user_id(), 'ironiq_admin') OR private.has_role(public.current_user_id(), 'consultant'))))
        WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a
                        WHERE a.id = %I.field_assessment_id
                          AND private.has_org_access(public.current_user_id(), a.organization_id)
                          AND (private.has_role(public.current_user_id(), 'ironiq_admin') OR private.has_role(public.current_user_id(), 'consultant'))))
    $f$, t, t, t);
  END LOOP;
END $$;-- 1. Assessment setup fields (additive, nullable)
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_production_events TO app_user;
GRANT ALL ON public.field_production_events TO app_admin;
ALTER TABLE public.field_production_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_production_events FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_production_events.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_production_events.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_event_marks TO app_user;
GRANT ALL ON public.field_event_marks TO app_admin;
ALTER TABLE public.field_event_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_event_marks FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_production_events e JOIN public.field_assessments a ON a.id = e.field_assessment_id
  WHERE e.id = field_event_marks.event_id AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_production_events e JOIN public.field_assessments a ON a.id = e.field_assessment_id
  WHERE e.id = field_event_marks.event_id AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_delays TO app_user;
GRANT ALL ON public.field_delays TO app_admin;
ALTER TABLE public.field_delays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_delays FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_delays.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_delays.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_cause_nodes TO app_user;
GRANT ALL ON public.field_cause_nodes TO app_admin;
ALTER TABLE public.field_cause_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_cause_nodes FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_cause_nodes.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_cause_nodes.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_evidence_items TO app_user;
GRANT ALL ON public.field_evidence_items TO app_admin;
ALTER TABLE public.field_evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_evidence_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_evidence_items.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_evidence_items.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_sme_dependencies TO app_user;
GRANT ALL ON public.field_sme_dependencies TO app_admin;
ALTER TABLE public.field_sme_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_sme_dependencies FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_sme_dependencies.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_sme_dependencies.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_baseline_metrics TO app_user;
GRANT ALL ON public.field_baseline_metrics TO app_admin;
ALTER TABLE public.field_baseline_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_baseline_metrics FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_baseline_metrics.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_baseline_metrics.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_pilots TO app_user;
GRANT ALL ON public.field_pilots TO app_admin;
ALTER TABLE public.field_pilots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_pilots FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_pilots.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a WHERE a.id = field_pilots.field_assessment_id
  AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_pilot_metrics TO app_user;
GRANT ALL ON public.field_pilot_metrics TO app_admin;
ALTER TABLE public.field_pilot_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ironclad staff access" ON public.field_pilot_metrics FOR ALL
USING (EXISTS (SELECT 1 FROM public.field_pilots p JOIN public.field_assessments a ON a.id = p.field_assessment_id
  WHERE p.id = field_pilot_metrics.pilot_id AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.field_pilots p JOIN public.field_assessments a ON a.id = p.field_assessment_id
  WHERE p.id = field_pilot_metrics.pilot_id AND private.has_org_access(public.current_user_id(), a.organization_id)
  AND (private.has_role(public.current_user_id(),'ironiq_admin'::app_role) OR private.has_role(public.current_user_id(),'consultant'::app_role))));
CREATE TRIGGER t_field_pilot_metrics_upd BEFORE UPDATE ON public.field_pilot_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();DROP POLICY IF EXISTS "job_files access" ON public.job_files;

CREATE POLICY "job_files select" ON public.job_files
FOR SELECT TO app_user
USING (private.can_read_job(job_id));

CREATE POLICY "job_files insert" ON public.job_files
FOR INSERT TO app_user
WITH CHECK (private.can_read_job(job_id) AND uploaded_by = public.current_user_id());

CREATE POLICY "job_files update" ON public.job_files
FOR UPDATE TO app_user
USING (
  private.can_read_job(job_id)
  AND (
    uploaded_by = public.current_user_id()
    OR private.has_role(public.current_user_id(), 'ironiq_admin'::public.app_role)
    OR private.has_role(public.current_user_id(), 'project_manager'::public.app_role)
  )
)
WITH CHECK (
  private.can_read_job(job_id)
  AND (
    uploaded_by = public.current_user_id()
    OR private.has_role(public.current_user_id(), 'ironiq_admin'::public.app_role)
    OR private.has_role(public.current_user_id(), 'project_manager'::public.app_role)
  )
);

CREATE POLICY "job_files delete" ON public.job_files
FOR DELETE TO app_user
USING (
  private.can_read_job(job_id)
  AND (
    uploaded_by = public.current_user_id()
    OR private.has_role(public.current_user_id(), 'ironiq_admin'::public.app_role)
    OR private.has_role(public.current_user_id(), 'project_manager'::public.app_role)
  )
);-- Explicit, modifiable allowlist for shared reference data access
CREATE TABLE IF NOT EXISTS public.cap_reference_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cap_reference_access_target_ck CHECK (num_nonnulls(user_id, role) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS cap_reference_access_user_uidx ON public.cap_reference_access(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cap_reference_access_role_uidx ON public.cap_reference_access(role) WHERE role IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_reference_access TO app_user;
GRANT ALL ON public.cap_reference_access TO app_admin;

ALTER TABLE public.cap_reference_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cap_reference_access admin manage"
  ON public.cap_reference_access FOR ALL TO app_user
  USING (private.has_role(public.current_user_id(), 'ironiq_admin'))
  WITH CHECK (private.has_role(public.current_user_id(), 'ironiq_admin'));

DROP TRIGGER IF EXISTS t_cap_reference_access_upd ON public.cap_reference_access;
CREATE TRIGGER t_cap_reference_access_upd BEFORE UPDATE ON public.cap_reference_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single, modifiable gate for reference-table reads
CREATE OR REPLACE FUNCTION private.can_read_cap_reference()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.current_user_id() IS NOT NULL
     AND (
       private.is_internal_user(public.current_user_id())
       OR EXISTS (
         SELECT 1 FROM public.cap_reference_access a
          WHERE a.user_id = public.current_user_id()
             OR (a.role IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.user_roles ur
                   WHERE ur.user_id = public.current_user_id() AND ur.role = a.role))
       )
     );
$$;

REVOKE ALL ON FUNCTION private.can_read_cap_reference() FROM PUBLIC, app_anon, app_user;

DROP POLICY IF EXISTS "cap_domains readable" ON public.cap_domains;
DROP POLICY IF EXISTS "cap_criteria readable" ON public.cap_criteria;

CREATE POLICY "cap_domains read" ON public.cap_domains FOR SELECT TO app_user
  USING (private.can_read_cap_reference());
CREATE POLICY "cap_domains admin manage" ON public.cap_domains FOR ALL TO app_user
  USING (private.has_role(public.current_user_id(), 'ironiq_admin'))
  WITH CHECK (private.has_role(public.current_user_id(), 'ironiq_admin'));

CREATE POLICY "cap_criteria read" ON public.cap_criteria FOR SELECT TO app_user
  USING (private.can_read_cap_reference());
CREATE POLICY "cap_criteria admin manage" ON public.cap_criteria FOR ALL TO app_user
  USING (private.has_role(public.current_user_id(), 'ironiq_admin'))
  WITH CHECK (private.has_role(public.current_user_id(), 'ironiq_admin'));

REVOKE INSERT, UPDATE, DELETE ON public.cap_domains FROM app_anon;
REVOKE INSERT, UPDATE, DELETE ON public.cap_criteria FROM app_anon;
REVOKE SELECT ON public.cap_domains FROM app_anon;
REVOKE SELECT ON public.cap_criteria FROM app_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_domains TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cap_criteria TO app_user;
GRANT ALL ON public.cap_domains TO app_admin;
GRANT ALL ON public.cap_criteria TO app_admin;