# Migration status: complete

All Supabase call sites have been converted to server functions running
against Postgres. `npx tsc --noEmit` passes with zero errors across the
whole repo, and `npm run build && npm run start` produces a working Node
server, tested against a real local Postgres instance with the schema in
`db/schema.sql` applied.

## What changed, end to end

- **Database**: `db/schema.sql` — all 24 original Supabase migrations
  converted to plain Postgres (`auth.users` → `app_users`, `auth.uid()` →
  `current_user_id()`, Supabase roles → `app_user`/`app_admin`). 146 RLS
  policies preserved and verified working (tested: zero role + zero org
  membership = zero visible rows; org isolation holds correctly).
- **Auth**: `src/lib/auth/` — bcrypt password hashing, cookie-based sessions
  (server-revocable, via TanStack Start's built-in encrypted session
  helper), signup/login/logout server functions, `requireAuth` middleware.
- **AI**: fully on Anthropic direct (`claude-sonnet-5` by default, `AI_MODEL`
  env var to override) — `ai-plan.functions.ts`, `capability-ai.functions.ts`,
  `field-ai.functions.ts`.
- **File storage**: `src/lib/storage.server.ts` — S3-compatible (Cloudflare
  R2, AWS S3, MinIO, etc.), replacing Supabase Storage. Needs
  `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
  configured before file upload/download features (evidence photos,
  geometry analysis file access) will work.
- **Data access**: every file that used to call Supabase's `.from().select()`
  browser client now calls a `createServerFn` in a matching `*.functions.ts`
  file, which runs the query server-side via `withUser`/`withAdmin` (see
  `src/lib/db.server.ts`) with RLS enforced exactly as it was under Supabase.
  The original hook files (`api.ts`, `mutations.ts`, `production-api.ts`,
  etc.) are now thin wrappers — every existing component's calling code is
  unchanged.
- **Hosting**: `render.yaml` provisions both a managed Postgres database and
  the Node web service in one Render Blueprint.

## Still open (by design, flagged rather than guessed at)

- **Google OAuth**: not implemented. Rolling your own auth means
  implementing Google's Authorization Code flow yourselves — the `arctic`
  npm package is a lightweight fit alongside the existing `app_users` /
  `app_sessions` tables. The "Continue with Google" button in
  `src/routes/auth.tsx` is disabled with a note pointing here.
- **Login/signup rate limiting**: not implemented. Nothing currently
  throttles repeated login or signup attempts against `auth.functions.ts`.

## Follow-up runtime/security pass (since this doc was first written)

A later session ran the schema + app against a real local Postgres end to
end and found two issues worth calling out here:

- **This doc's own instructions were incomplete.** Applying only
  `db/schema.sql` (as this file originally said, both here and in the
  Render setup steps below) boots the app with several feature areas'
  tables entirely missing — Business Development, CAD, CNC, the
  intelligence layer, product-access restrictions, and user approval all
  live in separate `db/schema_additions_*.sql` files that also need to be
  applied. Fixed below.
- **SQL injection in the generic upsert helpers** used by ~10
  `*.functions.ts` files (mutations, capability-api,
  capability-investigation-api, field-assessment-api, field-capture-api,
  field-ops-api, production-api, production-console,
  template-mutations, assessment-workflow): column names for
  UPDATE/INSERT were taken directly from client-supplied JSON keys with no
  validation, unlike table names which were already allowlisted. Verified
  exploitable against a live instance (arbitrary column writes within a
  row the attacker already had RLS-scoped access to). Fixed via a
  schema-derived per-table column allowlist — see
  `src/lib/column-allowlist.ts` and the PR that introduced it.
- **`npm run build` could silently ship a broken production bundle.**
  The build script didn't pin `NODE_ENV`, so if the ambient shell/CI
  environment had `NODE_ENV=development` set (or unset in a way something
  downstream defaulted from), the SSR bundle would embed React's dev JSX
  runtime and crash on every page render in production
  (`jsxDEV is not a function`). Fixed by pinning
  `NODE_ENV=production` explicitly in the `build` script via `cross-env`.
- **`.env.example` didn't exist**, despite being referenced by the Local
  dev instructions below and by a code comment in
  `src/lib/ai-gateway.server.ts`. Added.

Not yet done: a full staging pass exercising every individual data-access
query against seeded data (create a job, submit an assessment, upload
evidence, etc.) — the items above were caught by targeted testing, not an
exhaustive one.

## Render setup

1. Push this repo to your team's GitHub repo (upload the zip contents
   manually, or unzip and `git push` from your machine).
2. In Render, **New → Blueprint**, point it at the repo — `render.yaml`
   provisions the Postgres database and web service together.
3. After first deploy, apply the database schema once against the new
   database. This is **multiple files**, not just `schema.sql` — the base
   schema plus every feature area added on top of it (bulk intake, business
   development, CAD conversion, CNC change log, the pgvector intelligence
   layer, product access restrictions, and user approval). Applying only
   `schema.sql` boots the app with entire tables missing:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/schema_additions_bulk_intake.sql
   psql "$DATABASE_URL" -f db/schema_additions_bulk_intake_v2.sql
   psql "$DATABASE_URL" -f db/schema_additions_business_development.sql
   psql "$DATABASE_URL" -f db/schema_additions_business_development_interactions.sql
   psql "$DATABASE_URL" -f db/schema_additions_cad_conversion.sql
   psql "$DATABASE_URL" -f db/schema_additions_cnc_change_log.sql
   psql "$DATABASE_URL" -f db/schema_additions_intelligence_layer.sql
   psql "$DATABASE_URL" -f db/schema_additions_product_restrictions.sql
   psql "$DATABASE_URL" -f db/schema_additions_user_approval.sql
   psql "$DATABASE_URL" -f db/grant_connection_role.sql -v conn_user="$(psql "$DATABASE_URL" -tAc 'SELECT current_user')"
   ```
   (`$DATABASE_URL` is the _external_ connection string from Render's
   dashboard Connect tab — the internal one the web service uses won't work
   from your machine. The intelligence-layer file requires the `vector`
   extension to be enabled on the plan/instance you're deploying to —
   confirm that before running it.)
4. Fill in `ANTHROPIC_API_KEY` and the four `S3_*` variables in the Render
   dashboard (marked `sync: false` in `render.yaml`, so they're not stored
   in git). `DATABASE_URL` and `SESSION_SECRET` are wired automatically.

## Local dev

```bash
createdb ironiq_dev
psql ironiq_dev -f db/schema.sql
psql ironiq_dev -f db/schema_additions_bulk_intake.sql
psql ironiq_dev -f db/schema_additions_bulk_intake_v2.sql
psql ironiq_dev -f db/schema_additions_business_development.sql
psql ironiq_dev -f db/schema_additions_business_development_interactions.sql
psql ironiq_dev -f db/schema_additions_cad_conversion.sql
psql ironiq_dev -f db/schema_additions_cnc_change_log.sql
psql ironiq_dev -f db/schema_additions_intelligence_layer.sql   # requires the vector extension
psql ironiq_dev -f db/schema_additions_product_restrictions.sql
psql ironiq_dev -f db/schema_additions_user_approval.sql
psql ironiq_dev -c "GRANT app_user, app_admin TO $(whoami);"
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET, ANTHROPIC_API_KEY
npm install
npm run dev
```
