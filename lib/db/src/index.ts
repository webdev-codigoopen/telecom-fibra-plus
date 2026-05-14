import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const SUPABASE_PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? "gshtxnrishtqoheaxyeu";
const SUPABASE_REGION = process.env.SUPABASE_REGION ?? "us-east-1";

function buildSupabasePooledUrl(): string | null {
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (!pwd) return null;
  const ref = SUPABASE_PROJECT_REF;
  const region = SUPABASE_REGION;
  const encoded = encodeURIComponent(pwd);
  return `postgresql://postgres.${ref}:${encoded}@aws-1-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
}

function isValidPostgresUrl(v: string | undefined | null): v is string {
  if (!v) return false;
  return /^postgres(ql)?:\/\/.+@.+\/.+/i.test(v);
}

const candidates = [
  process.env.SUPABASE_DATABASE_URL,
  buildSupabasePooledUrl(),
  process.env.DATABASE_URL,
];
const connectionString = candidates.find(isValidPostgresUrl);

if (!connectionString) {
  throw new Error(
    "Database connection not configured. Set SUPABASE_DB_PASSWORD (preferred), SUPABASE_DATABASE_URL, or DATABASE_URL.",
  );
}

const isSupabase = /supabase\.(co|com)/i.test(connectionString);
const finalConnectionString = isSupabase
  ? connectionString.replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, p1, p2) =>
      p2 === "&" ? p1 : "",
    )
  : connectionString;
export const pool = new Pool({
  connectionString: finalConnectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
