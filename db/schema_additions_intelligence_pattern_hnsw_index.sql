-- Real bug fix, found while testing the reference-pattern-library work:
-- the original idx_intelligence_patterns_embedding index used ivfflat
-- with lists = 100. ivfflat requires a lot of data to cluster
-- meaningfully -- with far fewer rows than that (which is true for any
-- new deployment, and will remain true for a long time even in
-- production, since patterns only accumulate slowly from real
-- engagements), the default `probes = 1` setting means a similarity
-- search only inspects one of the ~100 (mostly empty or near-empty)
-- clusters, and can silently return FEWER matches than requested even
-- when clearly relevant rows exist and have valid embeddings.
--
-- Confirmed this was a real, live bug, not theoretical: reproduced it
-- directly under the app_user role (RLS enabled, the role every real
-- application query actually runs as) -- a query requesting 3 nearest
-- patterns out of 11 approved, embedded rows returned only 1. The same
-- query as a superuser (which bypasses RLS and therefore never
-- considered using this index at this row count) returned the correct
-- 3. In other words: this bug specifically affected every real request,
-- while looking fine under a naive superuser test -- exactly the kind of
-- thing that's easy to miss without checking under the actual runtime
-- role.
--
-- Fixed by switching to HNSW, which doesn't require enough data to fill
-- a fixed number of clusters and performs reasonably across a much
-- wider range of table sizes without needing to be retuned as the table
-- grows. Confirmed pgvector 0.6.0 (already installed) supports it.

DROP INDEX IF EXISTS public.idx_intelligence_patterns_embedding;

CREATE INDEX IF NOT EXISTS idx_intelligence_patterns_embedding_hnsw
  ON public.intelligence_patterns USING hnsw (embedding vector_cosine_ops);
