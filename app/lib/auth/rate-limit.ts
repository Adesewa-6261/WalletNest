import { ApiError } from "../api/errors";

// A crude in-memory limiter for login attempts.
//
// Be clear about what this is and isn't. Serverless functions are ephemeral and
// there may be many instances, so this map is per-instance and resets on every
// cold start. A determined attacker with a botnet routes around it easily.
//
// What it DOES stop is the realistic case: someone hammering one account's
// password from one place in a tight loop. That is worth stopping, and it costs
// nothing. It is not a substitute for a shared limiter (Upstash / Vercel KV),
// which is what this should become before the login form sees real traffic.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Throws once a key has failed too many times inside the window. */
export function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) return;

  if (entry.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((entry.resetAt - now) / 60000);
    throw new ApiError(
      "unauthorized",
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    );
  }
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}

/**
 * Identifies the caller for limiting purposes.
 *
 * x-forwarded-for is set by Vercel's proxy and is trustworthy there; the
 * left-most entry is the real client. Do not trust this header on a server that
 * is not behind a proxy that overwrites it — a client can send whatever it
 * likes, and would simply forge a new IP per attempt.
 */
export function callerIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
