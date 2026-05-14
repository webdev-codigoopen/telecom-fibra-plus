import { defineConfig } from "drizzle-kit";
import path from "path";

const SUPABASE_PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? "gshtxnrishtqoheaxyeu";
const SUPABASE_REGION = process.env.SUPABASE_REGION ?? "us-east-1";

function isValidPostgresUrl(v: string | undefined | null): v is string {
  if (!v) return false;
  return /^postgres(ql)?:\/\/.+@.+\/.+/i.test(v);
}

function buildSupabasePooledUrl(): string | null {
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (!pwd) return null;
  const encoded = encodeURIComponent(pwd);
  return `postgresql://postgres.${SUPABASE_PROJECT_REF}:${encoded}@aws-1-${SUPABASE_REGION}.pooler.supabase.com:5432/postgres?sslmode=require`;
}

const rawUrl = [
  process.env.SUPABASE_DATABASE_URL,
  buildSupabasePooledUrl(),
  process.env.DATABASE_URL,
].find(isValidPostgresUrl);

if (!rawUrl) {
  throw new Error(
    "Database connection not configured. Set SUPABASE_DB_PASSWORD (preferred), SUPABASE_DATABASE_URL, or DATABASE_URL.",
  );
}

const isSupabase = /supabase\.(co|com)/i.test(rawUrl);
const url = isSupabase
  ? rawUrl.replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, p1, p2) =>
      p2 === "&" ? p1 : "",
    )
  : rawUrl;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: isSupabase
    ? { url, ssl: { rejectUnauthorized: false } }
    : { url },
});
