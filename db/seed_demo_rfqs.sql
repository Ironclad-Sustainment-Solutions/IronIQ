-- Optional demo data. References organization 'a1000000-0000-4000-8000-000000000001'
-- which must exist first (this was a fixture only ever created manually in the
-- old Supabase dashboard, never part of any migration). Run manually if wanted.

INSERT INTO public.rfqs (id, organization_id, facility_id, rfq_number, customer_rfq_number, title, contact_name, contact_email, project_description, required_date, rfq_kind, export_controlled, itar, cui, status, files_use_confirmed, submitted_at, notes)
VALUES
 ('e1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','RFQ-2026-0001','PO-88421','Hydraulic manifold block','Dana Whitfield','dana.whitfield@meridiancast.example','Machined manifold block for the Kokomo press line hydraulic circuit.', current_date + 45, 'new_production', false, false, false, 'ready_for_estimating', true, now() - interval '3 days', 'Customer wants pricing at 25 and 100 pc.'),
 ('e1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','RFQ-2026-0002','PO-88510','Turbine spacer ring','Marcus Reyes','marcus.reyes@meridiancast.example','Five-axis spacer ring for hot-section test rig.', current_date + 30, 'prototype', true, false, true, 'ready_for_estimating', true, now() - interval '1 day', 'Export-controlled data — internal handling only.');
INSERT INTO public.rfq_parts (id, rfq_id, organization_id, part_number, revision, description, quantity, sort_order)
VALUES
 ('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','MB-4471','C','Hydraulic manifold block, 6-port', 25, 1),
 ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','TS-2210','A','Turbine spacer ring, hot section', 8, 1);
INSERT INTO public.rfq_requirements (rfq_part_id, material_id, material_grade, customer_supplied_material, stock_shape, stock_dim_a, stock_dim_b, stock_dim_c, units, general_tolerance, critical_tolerances, surface_finish, heat_treatment, coating, inspection_level, material_certification, fai_required, special_packaging, notes, requested_machine_type, existing_fixture, existing_program, target_price, requested_turnaround_days)
VALUES
 ('e2000000-0000-4000-8000-000000000001','b2d17b15-3d94-4e5c-b8f7-5536da14dd00','6061-T6', false, 'plate', 8.5, 5.25, 3.0, 'in', '+/- 0.005', 'Bore positions +/- 0.0005', '63 Ra', NULL, 'Type II anodize', 'Level 2', true, true, NULL, 'Ports must be deburred and flushed.', 'mill_3axis', false, false, 480, 30),
 ('e2000000-0000-4000-8000-000000000002','1fbdf727-7d3b-4ee2-bc90-3579e12960bf','Inconel 718', false, 'bar', 6.0, 6.0, 2.25, 'in', '+/- 0.003', 'Seal face flatness 0.0003', '32 Ra', 'Solution + age per AMS 5663', 'Dry film lube', 'Level 3', true, true, 'Individual foam-lined case', 'Prototype rig hardware — schedule critical.', 'mill_5axis', false, false, NULL, 21);
INSERT INTO public.rfq_files (id, rfq_id, rfq_part_id, organization_id, bucket, storage_path, file_name, file_extension, file_size, file_kind, revision, superseded, checksum, upload_status)
VALUES
 ('e3000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','rfq-source-models','a1000000-0000-4000-8000-000000000001/e1000000-0000-4000-8000-000000000001/MB-4471_revC.step','MB-4471_revC.step','step', 4823110, 'model_3d', 1, false, 'demo-checksum-mb4471','uploaded'),
 ('e3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','rfq-source-models','a1000000-0000-4000-8000-000000000001/e1000000-0000-4000-8000-000000000002/TS-2210_revA.step','TS-2210_revA.step','step', 2611884, 'model_3d', 1, false, 'demo-checksum-ts2210','uploaded');
