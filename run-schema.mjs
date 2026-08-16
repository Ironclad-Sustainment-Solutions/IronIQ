// Run with: node run-schema.mjs "postgres://...external-url..." 
// Loads db/schema.sql, then grants the connecting role app_user/app_admin.
import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("Usage: node run-schema.mjs <DATABASE_URL>");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("Applying db/schema.sql ...");
const schema = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
await client.query(schema);
console.log("Schema applied.");

console.log("Granting app_user/app_admin to the connection role ...");
const { rows } = await client.query("SELECT current_user");
const connUser = rows[0].current_user;
await client.query(`GRANT app_user, app_admin TO "${connUser}"`);
console.log(`Granted to "${connUser}".`);

await client.end();
console.log("Done.");
