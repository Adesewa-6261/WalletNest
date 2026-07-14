import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver, not a TCP pool: serverless functions are short-lived and
// a connection pool would leak sockets across invocations. Each query is one
// HTTPS round trip, which is also why this works fine on Vercel's runtime.
//
// `sql` is a tagged template. Interpolated values are sent as bound parameters,
// never spliced into the SQL string, so `sql\`... WHERE email = ${input}\`` is
// safe against injection by construction. Never build a query by concatenating
// strings — that throws the guarantee away.

let cached: ReturnType<typeof neon> | null = null;

export function db() {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision Neon Postgres (vercel integration add neon) and pull the env with `vercel env pull .env.local`."
    );
  }

  cached = neon(url);
  return cached;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
