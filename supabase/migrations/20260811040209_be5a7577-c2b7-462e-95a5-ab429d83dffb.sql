
CREATE POLICY "field evidence org read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'field-evidence' AND EXISTS (
  SELECT 1 FROM public.field_assessments a
  WHERE a.id::text = (storage.foldername(name))[1]
    AND private.has_org_access(auth.uid(), a.organization_id)));

CREATE POLICY "field evidence org insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'field-evidence' AND EXISTS (
  SELECT 1 FROM public.field_assessments a
  WHERE a.id::text = (storage.foldername(name))[1]
    AND private.has_org_access(auth.uid(), a.organization_id)));

CREATE POLICY "field evidence org delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'field-evidence' AND EXISTS (
  SELECT 1 FROM public.field_assessments a
  WHERE a.id::text = (storage.foldername(name))[1]
    AND private.has_org_access(auth.uid(), a.organization_id)));
