#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// Applies db/schema.sql. Idempotent — every statement is CREATE ... IF NOT
// EXISTS, so running it twice is a no-op rather than an error.
//
//   npm run db:migrate

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(`
  DATABASE_URL is not set.

  Locally:  vercel env pull .env.local
  Then:     npm run db:migrate
`);
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(
  new URL("../app/lib/db/schema.sql", import.meta.url),
  "utf8"
);

// The driver sends one statement per call, so split on semicolons at the end of
// a line. The schema deliberately contains no functions or DO blocks, which
// would make naive splitting unsafe.
//
// Strip leading comment lines from each chunk rather than skipping any chunk
// that begins with one — a comment above a statement is part of that chunk, and
// discarding it would silently drop the statement itself.
const stripLeadingComments = (chunk) =>
  chunk
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();

const statements = schema
  .split(/;\s*$/m)
  .map(stripLeadingComments)
  .filter((s) => s.length > 0);

console.log(`Applying ${statements.length} statements…\n`);

for (const statement of statements) {
  const label = statement.split("\n")[0].slice(0, 68);
  try {
    await sql.query(statement);
    console.log(`  ok   ${label}`);
  } catch (err) {
    console.error(`  FAIL ${label}`);
    console.error(`       ${err.message}`);
    process.exit(1);
  }
}

console.log("\nSchema is up to date.");
