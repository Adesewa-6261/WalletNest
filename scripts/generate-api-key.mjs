#!/usr/bin/env node
import { randomBytes, createHash } from "node:crypto";

// Mints an API key and prints the SHA-256 hash you store in the environment.
// The plaintext key is shown exactly once, here — the server only ever sees
// hashes, so a leaked env var cannot be turned back into working keys.
//
//   npm run generate-key
//   npm run generate-key -- staging

const env = process.argv[2] ?? "live";

if (!/^[a-z0-9]+$/.test(env)) {
  console.error(`Invalid environment label '${env}'. Use lowercase letters and digits.`);
  process.exit(1);
}

// 32 bytes = 256 bits of entropy. base64url so the key is copy-paste safe.
const key = `wnk_${env}_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(key).digest("hex");

console.log(`
  Secret key (shown once — copy it now, give it to the consumer):

    ${key}

  Hash (safe to commit to your env config, NOT secret):

    ${hash}

  Add the hash to WALLETNEST_API_KEYS. Comma-separate to allow several keys:

    WALLETNEST_API_KEYS=${hash}

  Locally, put that line in .env.local.
  On Vercel:  vercel env add WALLETNEST_API_KEYS

  To revoke a key, delete its hash and redeploy.
`);
