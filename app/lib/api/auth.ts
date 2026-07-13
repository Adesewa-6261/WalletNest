import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors";

// API keys live in the WALLETNEST_API_KEYS env var as comma-separated
// SHA-256 hashes (hex), never as plaintext. Generate one with:
//
//   npm run generate-key
//
// The tradeoff of storing keys in env: there is no per-key metadata, no usage
// tracking, and revoking a key means editing the env var and redeploying.
// That is acceptable for a small number of trusted consumers. Once you need
// self-serve keys, move this lookup to a database (Vercel KV / Postgres) —
// only `allowedHashes` below has to change.

const KEY_PREFIX = "wnk_";
const SHA256_BYTES = 32;

// Parsed once per warm serverless instance. Env cannot change without a
// redeploy, which gives us a fresh instance anyway.
let cachedHashes: Buffer[] | null = null;

function allowedHashes(): Buffer[] {
  if (cachedHashes) return cachedHashes;

  const raw = process.env.WALLETNEST_API_KEYS ?? "";
  cachedHashes = raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
    .map((h) => Buffer.from(h, "hex"));

  return cachedHashes;
}

// Pull the key out of either accepted header. Bearer wins if both are present.
function extractKey(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization) {
    const [scheme, value] = authorization.split(/\s+/);
    if (scheme?.toLowerCase() === "bearer" && value) return value;
    return null; // An Authorization header we don't understand is not a fallback.
  }

  return headers.get("x-api-key");
}

// Constant-time membership test. Both sides are always 32 bytes because they
// are SHA-256 digests, so timingSafeEqual never throws on a length mismatch —
// which matters, since a length check would itself leak information.
function isKnownHash(candidate: Buffer): boolean {
  let matched = false;
  for (const known of allowedHashes()) {
    if (candidate.length === SHA256_BYTES && timingSafeEqual(candidate, known)) {
      matched = true;
    }
  }
  return matched;
}

export interface AuthenticatedCaller {
  /** First 8 hex chars of the key's hash. Safe to log; identifies the key. */
  keyId: string;
}

/**
 * Verifies the caller's API key, or throws.
 *
 * Fails closed: if no keys are configured, every request is rejected with a
 * 503 rather than being let through. An unconfigured deploy is a broken deploy,
 * not an open one.
 */
export function authenticate(request: Request): AuthenticatedCaller {
  if (allowedHashes().length === 0) {
    console.error(
      "WALLETNEST_API_KEYS is unset or contains no valid SHA-256 hashes — refusing all API requests."
    );
    throw new ApiError(
      "server_misconfigured",
      "This deployment has no API keys configured."
    );
  }

  const key = extractKey(request.headers);
  if (!key) {
    throw new ApiError(
      "unauthorized",
      "Missing API key. Send 'Authorization: Bearer <key>' or 'X-API-Key: <key>'."
    );
  }

  if (!key.startsWith(KEY_PREFIX)) {
    throw new ApiError(
      "unauthorized",
      `Malformed API key. Keys begin with '${KEY_PREFIX}'.`
    );
  }

  const digest = createHash("sha256").update(key).digest();
  if (!isKnownHash(digest)) {
    // Deliberately identical wording to the missing-key case would be unhelpful
    // here; a caller needs to distinguish "I forgot the header" from "my key is
    // dead". Neither message reveals anything about which keys exist.
    throw new ApiError("unauthorized", "Unrecognized API key.");
  }

  return { keyId: digest.toString("hex").slice(0, 8) };
}
