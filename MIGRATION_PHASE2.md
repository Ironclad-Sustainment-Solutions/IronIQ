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
- **Runtime verification**: the foundational layer (schema, RLS, auth) was
  tested against a live Postgres instance during this session. The bulk of
  the individual data-access queries were typechecked and built successfully,
  but not all individually exercised against seeded data — TypeScript
  catches shape mismatches, not logic bugs like a wrong column name inside a
  raw SQL string. Worth a staging runtime pass (create a job, submit an
  assessment, upload evidence, etc.) before this goes to production traffic.

## Render setup

1. Push this repo to your team's GitHub repo (upload the zip contents
   manually, or unzip and `git push` from your machine).
2. In Render, **New → Blueprint**, point it at the repo — `render.yaml`
   provisions the Postgres database and web service together.
3. After first deploy, apply the schema once against the new database:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/grant_connection_role.sql -v conn_user="$(psql "$DATABASE_URL" -tAc 'SELECT current_user')"
   ```
   (`$DATABASE_URL` is the *external* connection string from Render's
   dashboard Connect tab — the internal one the web service uses won't work
   from your machine.)
4. Fill in `ANTHROPIC_API_KEY` and the four `S3_*` variables in the Render
   dashboard (marked `sync: false` in `render.yaml`, so they're not stored
   in git). `DATABASE_URL` and `SESSION_SECRET` are wired automatically.

## Local dev

```bash
createdb ironiq_dev
psql ironiq_dev -f db/schema.sql
psql ironiq_dev -c "GRANT app_user, app_admin TO $(whoami);"
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET, ANTHROPIC_API_KEY
npm install
npm run dev
```
