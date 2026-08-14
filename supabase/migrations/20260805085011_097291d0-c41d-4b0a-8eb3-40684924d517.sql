-- ENUMS
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
  SELECT _user_id IS NOT NULL AND _user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ironiq_admin','consultant','facility_manager'));
$$;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;

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
TO authenticated;
GRANT ALL ON
  public.materials, public.material_prices, public.stock_catalog, public.machines,
  public.machine_capabilities, public.machine_rates, public.tools, public.tool_inventory,
  public.rfqs, public.rfq_status_history, public.rfq_parts, public.rfq_requirements, public.rfq_files,
  public.geometry_analysis_runs, public.manufacturing_features,
  public.estimates, public.estimate_line_items, public.estimate_assumptions,
  public.quotes, public.quote_revisions, public.quote_approvals,
  public.programming_work_orders, public.work_order_status_history, public.cam_files,
  public.nc_programs, public.simulation_results, public.historical_jobs, public.actual_job_results
TO service_role;

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
CREATE POLICY "internal_manage_materials" ON public.materials FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_material_prices" ON public.material_prices FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_stock_catalog" ON public.stock_catalog FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_machines" ON public.machines FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_machine_capabilities" ON public.machine_capabilities FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_machine_rates" ON public.machine_rates FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_tools" ON public.tools FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_tool_inventory" ON public.tool_inventory FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_estimates" ON public.estimates FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_estimate_line_items" ON public.estimate_line_items FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_estimate_assumptions" ON public.estimate_assumptions FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_quote_approvals" ON public.quote_approvals FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_quote_revisions" ON public.quote_revisions FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_cam_files" ON public.cam_files FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_nc_programs" ON public.nc_programs FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_simulation_results" ON public.simulation_results FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_geometry_runs" ON public.geometry_analysis_runs FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_features" ON public.manufacturing_features FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_historical_jobs" ON public.historical_jobs FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_actual_results" ON public.actual_job_results FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_manage_wo_history" ON public.work_order_status_history FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- Org-scoped tables (customers see their own)
CREATE POLICY "org_read_rfqs" ON public.rfqs FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "org_write_rfqs" ON public.rfqs FOR ALL TO authenticated USING (public.has_org_access(auth.uid(), organization_id)) WITH CHECK (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "org_rfq_parts" ON public.rfq_parts FOR ALL TO authenticated USING (public.has_org_access(auth.uid(), organization_id)) WITH CHECK (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "org_rfq_files" ON public.rfq_files FOR ALL TO authenticated USING (public.has_org_access(auth.uid(), organization_id)) WITH CHECK (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "org_rfq_requirements" ON public.rfq_requirements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfq_parts p WHERE p.id = rfq_part_id AND public.has_org_access(auth.uid(), p.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfq_parts p WHERE p.id = rfq_part_id AND public.has_org_access(auth.uid(), p.organization_id)));
CREATE POLICY "org_rfq_status_history" ON public.rfq_status_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND public.has_org_access(auth.uid(), r.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_id AND public.has_org_access(auth.uid(), r.organization_id)));
CREATE POLICY "org_quotes_read" ON public.quotes FOR SELECT TO authenticated USING (public.has_org_access(auth.uid(), organization_id));
CREATE POLICY "internal_quotes_write" ON public.quotes FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "org_work_orders_read" ON public.programming_work_orders FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "internal_work_orders_write" ON public.programming_work_orders FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

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
REVOKE EXECUTE ON FUNCTION public.next_rfq_number(), public.next_quote_number(), public.next_work_order_number() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_rfq_number(), public.next_quote_number(), public.next_work_order_number() TO authenticated;