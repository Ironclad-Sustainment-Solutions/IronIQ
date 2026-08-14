CREATE POLICY "org_scoped_rfq_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('rfq-source-models','rfq-drawings','rfq-supporting-files','quote-documents')
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "org_scoped_rfq_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('rfq-source-models','rfq-drawings','rfq-supporting-files','quote-documents')
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "org_scoped_rfq_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('rfq-source-models','rfq-drawings','rfq-supporting-files','quote-documents')
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id IN ('rfq-source-models','rfq-drawings','rfq-supporting-files','quote-documents')
  AND public.has_org_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "internal_only_cam_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('cam-working-files','nc-programs','simulation-reports') AND public.is_internal_user(auth.uid()));
CREATE POLICY "internal_only_cam_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('cam-working-files','nc-programs','simulation-reports') AND public.is_internal_user(auth.uid()));
CREATE POLICY "internal_only_cam_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('cam-working-files','nc-programs','simulation-reports') AND public.is_internal_user(auth.uid()))
WITH CHECK (bucket_id IN ('cam-working-files','nc-programs','simulation-reports') AND public.is_internal_user(auth.uid()));
CREATE POLICY "internal_only_cam_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('cam-working-files','nc-programs','simulation-reports') AND public.is_internal_user(auth.uid()));