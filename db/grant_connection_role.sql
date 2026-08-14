-- One-time setup after applying schema.sql: let Render's connection user
-- (the one baked into DATABASE_URL) switch into app_user/app_admin per
-- request via `SET LOCAL ROLE`.
--
-- Usage:
--   psql "$DATABASE_URL" -v conn_user="$(psql "$DATABASE_URL" -tAc 'SELECT current_user')" -f db/grant_connection_role.sql
-- or simpler, just run this one line manually with your actual DB username:
--   GRANT app_user, app_admin TO your_render_db_username;
GRANT app_user, app_admin TO :conn_user;
