import { NextResponse } from "next/server";
import { login } from "@/app/lib/auth/users";
import { createSession } from "@/app/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
  callerIp,
} from "@/app/lib/auth/rate-limit";
import { ApiError } from "@/app/lib/api/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = callerIp(request);

  try {
    checkRateLimit(ip);

    const body = await request.json();
    const user = await login(body?.email, body?.password);

    clearFailures(ip);
    await createSession(user.id);

    return NextResponse.json({ email: user.email });
  } catch (err) {
    if (err instanceof ApiError) {
      // Only count genuine credential failures. A malformed body is a bug in
      // the client, not an attack, and shouldn't burn the user's attempts.
      if (err.code === "unauthorized") recordFailure(ip);

      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }

    console.error("login failed", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not sign you in." } },
      { status: 500 }
    );
  }
}
