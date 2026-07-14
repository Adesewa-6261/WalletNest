import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { db, type User, type ApiKeyRow } from "../db";
import { ApiError } from "../api/errors";

// Cost 12: roughly 250ms per hash on Vercel's hardware. High enough that
// offline brute-forcing a stolen hash is expensive, low enough that a login
// doesn't feel slow. Raise it as hardware gets faster.
const BCRYPT_COST = 12;

const MIN_PASSWORD_LENGTH = 10;

// ---------- validation ----------

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ApiError("invalid_request", "Email is required.");
  }

  const email = raw.trim().toLowerCase();

  // Deliberately permissive. Email syntax is far weirder than most regexes
  // assume, and over-strict validation rejects real addresses. The only thing
  // that truly proves an address works is sending mail to it.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError("invalid_request", "That doesn't look like a valid email address.");
  }

  return email;
}

function validatePassword(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ApiError("invalid_request", "Password is required.");
  }

  if (raw.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(
      "invalid_request",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  // bcrypt silently truncates beyond 72 bytes; rejecting is honest, whereas
  // accepting would mean the tail of a long passphrase does nothing.
  if (Buffer.byteLength(raw, "utf8") > 72) {
    throw new ApiError("invalid_request", "Password must be at most 72 bytes.");
  }

  return raw;
}

// ---------- accounts ----------

export async function signup(
  rawEmail: unknown,
  rawPassword: unknown
): Promise<User> {
  const email = normalizeEmail(rawEmail);
  const password = validatePassword(rawPassword);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const sql = db();

  // Let the unique index decide, rather than checking-then-inserting: two
  // simultaneous signups with the same email would both pass a prior check and
  // one would still fail here. The database is the only place that can settle
  // this race.
  try {
    const rows = (await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id, email, password_hash, created_at
    `) as User[];

    return rows[0];
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("users_email_lower_idx") || message.includes("duplicate key")) {
      throw new ApiError("invalid_request", "An account with that email already exists.");
    }
    throw err;
  }
}

export async function login(
  rawEmail: unknown,
  rawPassword: unknown
): Promise<User> {
  const email = normalizeEmail(rawEmail);

  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    throw new ApiError("unauthorized", "Email or password is incorrect.");
  }

  const sql = db();
  const rows = (await sql`
    SELECT id, email, password_hash, created_at FROM users
    WHERE lower(email) = ${email}
    LIMIT 1
  `) as User[];

  const user = rows[0];

  // Compare against a dummy hash when the user doesn't exist, so that a missing
  // account and a wrong password take the same time. Returning early here would
  // leak which emails are registered to anyone with a stopwatch.
  const hash = user?.password_hash ?? "$2a$12$eImiTXuWVxfM37uY4JANjQ.ONtqjTgVIt9DDCwGl0jXMYX4Xrzsxi";
  const ok = await bcrypt.compare(rawPassword, hash);

  // One message for both failures. Telling an attacker "no such user" hands
  // them a free way to enumerate who has an account.
  if (!user || !ok) {
    throw new ApiError("unauthorized", "Email or password is incorrect.");
  }

  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  const sql = db();
  const rows = (await sql`
    SELECT id, email, password_hash, created_at FROM users WHERE id = ${id} LIMIT 1
  `) as User[];
  return rows[0] ?? null;
}

// ---------- api keys ----------

/** What the user sees exactly once, at creation. */
export interface NewApiKey {
  row: ApiKeyRow;
  plaintext: string;
}

export async function createApiKey(
  userId: string,
  rawName: unknown
): Promise<NewApiKey> {
  const name =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim().slice(0, 60)
      : "Untitled key";

  // 32 bytes = 256 bits of entropy, base64url so it's copy-paste safe.
  const plaintext = `wnk_live_${randomBytes(32).toString("base64url")}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");
  const keyPrefix = plaintext.slice(0, 17); // "wnk_live_" + 8 chars

  const sql = db();
  const rows = (await sql`
    INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
    VALUES (${userId}, ${name}, ${keyHash}, ${keyPrefix})
    RETURNING id, user_id, name, key_hash, key_prefix, created_at, last_used_at, revoked_at
  `) as ApiKeyRow[];

  return { row: rows[0], plaintext };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const sql = db();
  return (await sql`
    SELECT id, user_id, name, key_hash, key_prefix, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as ApiKeyRow[];
}

/**
 * Revokes a key. Scoped to the owner: the `user_id` in the WHERE clause is what
 * stops one user revoking another's key by guessing an id. Never look a key up
 * by id alone and then check ownership afterwards — do it in one statement.
 *
 * Returns false if the key doesn't exist, isn't theirs, or was already revoked.
 */
export async function revokeApiKey(
  userId: string,
  keyId: string
): Promise<boolean> {
  const sql = db();
  const rows = (await sql`
    UPDATE api_keys
    SET revoked_at = now()
    WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `) as { id: string }[];

  return rows.length > 0;
}
