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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_profiles TO authenticated;
GRANT ALL ON public.machine_profiles TO service_role;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tooling_profiles TO authenticated;
GRANT ALL ON public.tooling_profiles TO service_role;
ALTER TABLE public.tooling_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, controller text NOT NULL, machine_family text,
  version text NOT NULL DEFAULT '1.0', notes text,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_processors TO authenticated;
GRANT ALL ON public.post_processors TO service_role;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programmer_capabilities TO authenticated;
GRANT ALL ON public.programmer_capabilities TO service_role;
ALTER TABLE public.programmer_capabilities ENABLE ROW LEVEL SECURITY;

-- reference RLS: read for signed-in users, write for platform staff
CREATE POLICY "machine_profiles read" ON public.machine_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "machine_profiles manage" ON public.machine_profiles FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "tooling_profiles read" ON public.tooling_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "tooling_profiles manage" ON public.tooling_profiles FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "post_processors read" ON public.post_processors FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_processors manage" ON public.post_processors FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY "capabilities read" ON public.programmer_capabilities FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR programmer_id = auth.uid());
CREATE POLICY "capabilities manage" ON public.programmer_capabilities FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR programmer_id = auth.uid())
  WITH CHECK (public.is_platform_staff(auth.uid()) OR programmer_id = auth.uid());

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
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
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
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.organization_members m ON m.organization_id = j.organization_id
      WHERE j.id = _job_id AND m.user_id = auth.uid()
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_job(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_job(uuid) TO authenticated, service_role;

CREATE POLICY "jobs read" ON public.jobs FOR SELECT TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "jobs insert" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.has_org_access(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "jobs update" ON public.jobs FOR UPDATE TO authenticated
  USING (public.has_org_access(auth.uid(), organization_id))
  WITH CHECK (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "jobs delete" ON public.jobs FOR DELETE TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- ============ CHILD TABLES ============
CREATE TABLE public.job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  file_name text NOT NULL, file_kind text NOT NULL DEFAULT 'other',
  file_size bigint, storage_path text NOT NULL, notes text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%1$s access" ON public.%1$I FOR ALL TO authenticated
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
REVOKE EXECUTE ON FUNCTION public.select_programmer_for_job(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_programmer_for_job(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.complexity_rank(public.complexity_level) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complexity_rank(public.complexity_level) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.next_job_number() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_job_number() TO authenticated, service_role;

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
CREATE POLICY "job files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-files' AND public.can_read_job(NULLIF(split_part(name,'/',1),'')::uuid));
CREATE POLICY "job files write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-files' AND public.can_read_job(NULLIF(split_part(name,'/',1),'')::uuid));
CREATE POLICY "job files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-files' AND public.can_read_job(NULLIF(split_part(name,'/',1),'')::uuid));
CREATE POLICY "job files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-files' AND public.can_read_job(NULLIF(split_part(name,'/',1),'')::uuid));