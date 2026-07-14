import { createHash, timingSafeEqual } from "node:crypto";
import { db, type ApiKeyRow } from "../db";
import { ApiError } from "./errors";

// API keys are issued self-serve: a user signs up, creates a key in the
// dashboard, and it works immediately. No redeploy, because keys live in the
// database rather than in an environment variable.
//
// WALLETNEST_API_KEYS still works, as a comma-separated list of SHA-256 hashes.
// It is the bootstrap path — the keys that existed before there was a database,
// and the escape hatch if the database is ever unreachable. New keys should
// come from the dashboard.

const KEY_PREFIX = "wnk_";
const SHA256_BYTES = 32;

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

// ---------- legacy: hashes in the environment ----------

let cachedEnvHashes: Buffer[] | null = null;

function envHashes(): Buffer[] {
  if (cachedEnvHashes) return cachedEnvHashes;

  cachedEnvHashes = (process.env.WALLETNEST_API_KEYS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
    .map((h) => Buffer.from(h, "hex"));

  return cachedEnvHashes;
}

// Constant-time membership test. Both sides are always 32 bytes because they
// are SHA-256 digests, so timingSafeEqual never throws on a length mismatch.
function matchesEnvHash(candidate: Buffer): boolean {
  let matched = false;
  for (const known of envHashes()) {
    if (candidate.length === SHA256_BYTES && timingSafeEqual(candidate, known)) {
      matched = true;
    }
  }
  return matched;
}

// ---------- database-backed keys ----------

async function findDbKey(keyHashHex: string): Promise<ApiKeyRow | null> {
  const sql = db();

  // Looked up on every request, deliberately uncached. A cache would mean a
  // revoked key kept working until it expired — and instant revocation is the
  // whole reason keys moved into the database. One indexed lookup is a fair
  // price for that.
  //
  // Comparing hashes (not the key itself) means a timing side-channel here
  // could only reveal a hash, which is already public-ish. No secret leaks.
  const rows = (await sql`
    SELECT id, user_id, name, key_hash, key_prefix, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE key_hash = ${keyHashHex}
    LIMIT 1
  `) as ApiKeyRow[];

  return rows[0] ?? null;
}

/** Best-effort "last used" stamp. Never blocks or fails the request. */
function touchKey(keyId: string): void {
  const sql = db();
  void sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${keyId}`.catch(
    (err) => console.error("failed to stamp last_used_at", err)
  );
}

export interface AuthenticatedCaller {
  /** First 8 hex chars of the key's hash. Safe to log; identifies the key. */
  keyId: string;
  /** The owning account, when the key came from the database. */
  userId: string | null;
}

/**
 * Verifies the caller's API key, or throws.
 *
 * Order matters: the database is the source of truth for keys issued through
 * the dashboard, and the environment list is only consulted as a fallback. A
 * key revoked in the database is dead even if its hash somehow also appears in
 * the environment — revocation must never be silently overridden.
 */
export async function authenticate(
  request: Request
): Promise<AuthenticatedCaller> {
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
  const digestHex = digest.toString("hex");

  let row: ApiKeyRow | null = null;
  let dbReachable = true;

  try {
    row = await findDbKey(digestHex);
  } catch (err) {
    // The database is down. Fall through to the environment list so that
    // bootstrap keys still work, rather than taking the whole API down with it.
    console.error("API key lookup failed; falling back to env keys", err);
    dbReachable = false;
  }

  if (row) {
    if (row.revoked_at) {
      throw new ApiError(
        "unauthorized",
        "This API key has been revoked. Create a new one in your dashboard."
      );
    }

    touchKey(row.id);
    return { keyId: digestHex.slice(0, 8), userId: row.user_id };
  }

  if (matchesEnvHash(digest)) {
    return { keyId: digestHex.slice(0, 8), userId: null };
  }

  // Nothing matched. If the database was unreachable we cannot be certain the
  // key is invalid — say so honestly rather than accusing the caller.
  if (!dbReachable && envHashes().length === 0) {
    throw new ApiError(
      "internal_error",
      "Unable to verify API keys right now. Try again shortly."
    );
  }

  throw new ApiError("unauthorized", "Unrecognized API key.");
}
