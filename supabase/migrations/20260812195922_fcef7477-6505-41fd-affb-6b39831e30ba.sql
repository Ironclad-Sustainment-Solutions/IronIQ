DROP POLICY IF EXISTS "job_files access" ON public.job_files;

CREATE POLICY "job_files select" ON public.job_files
FOR SELECT TO authenticated
USING (private.can_read_job(job_id));

CREATE POLICY "job_files insert" ON public.job_files
FOR INSERT TO authenticated
WITH CHECK (private.can_read_job(job_id) AND uploaded_by = auth.uid());

CREATE POLICY "job_files update" ON public.job_files
FOR UPDATE TO authenticated
USING (
  private.can_read_job(job_id)
  AND (
    uploaded_by = auth.uid()
    OR private.has_role(auth.uid(), 'ironiq_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'project_manager'::public.app_role)
  )
)
WITH CHECK (
  private.can_read_job(job_id)
  AND (
    uploaded_by = auth.uid()
    OR private.has_role(auth.uid(), 'ironiq_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'project_manager'::public.app_role)
  )
);

CREATE POLICY "job_files delete" ON public.job_files
FOR DELETE TO authenticated
USING (
  private.can_read_job(job_id)
  AND (
    uploaded_by = auth.uid()
    OR private.has_role(auth.uid(), 'ironiq_admin'::public.app_role)
    OR private.has_role(auth.uid(), 'project_manager'::public.app_role)
  )
);