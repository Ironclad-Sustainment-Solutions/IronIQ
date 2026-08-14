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
  FOR ALL TO authenticated
  USING (
    private.has_org_access(auth.uid(), organization_id)
    AND (private.has_role(auth.uid(), 'ironiq_admin') OR private.has_role(auth.uid(), 'consultant'))
  )
  WITH CHECK (
    private.has_org_access(auth.uid(), organization_id)
    AND (private.has_role(auth.uid(), 'ironiq_admin') OR private.has_role(auth.uid(), 'consultant'))
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
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM public.field_assessments a
                        WHERE a.id = %I.field_assessment_id
                          AND private.has_org_access(auth.uid(), a.organization_id)
                          AND (private.has_role(auth.uid(), 'ironiq_admin') OR private.has_role(auth.uid(), 'consultant'))))
        WITH CHECK (EXISTS (SELECT 1 FROM public.field_assessments a
                        WHERE a.id = %I.field_assessment_id
                          AND private.has_org_access(auth.uid(), a.organization_id)
                          AND (private.has_role(auth.uid(), 'ironiq_admin') OR private.has_role(auth.uid(), 'consultant'))))
    $f$, t, t, t);
  END LOOP;
END $$;