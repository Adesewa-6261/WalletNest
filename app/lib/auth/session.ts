import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// Browser sessions for the WalletNest account area (signup / login / key
// management). This is entirely separate from API-key auth in lib/api/auth.ts:
//
//   session cookie  -> a human, in a browser, managing their keys
//   API key header  -> a machine, calling /api/v1
//
// Conflating the two is how you end up with a cookie that can call your API,
// which is what CSRF exploits. They never mix: /api/v1 does not read cookies.

const COOKIE_NAME = "wn_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;

  // Fail loudly rather than fall back to a default. A hardcoded fallback secret
  // is worse than no auth at all: it looks secure while letting anyone who has
  // read the source forge a session for any account.
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  return new TextEncoder().encode(value);
}

/** Issues a signed session cookie for a user. */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  cookies().set(COOKIE_NAME, token, {
    // Unreadable to JavaScript, so an XSS bug cannot steal the session.
    httpOnly: true,
    // HTTPS-only in production; allowed over http on localhost so dev works.
    secure: process.env.NODE_ENV === "production",
    // The cookie is not sent on cross-site requests, which is what stops
    // another site from silently acting as the logged-in user (CSRF).
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Returns the logged-in user's id, or null. Never throws on a bad cookie. */
export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Expired, tampered with, or signed by a rotated secret. All mean the same
    // thing to a caller: not logged in.
    return null;
  }
}

export function destroySession(): void {
  cookies().delete(COOKIE_NAME);
}
