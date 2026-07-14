import { NextResponse } from "next/server";
import { signup } from "@/app/lib/auth/users";
import { createSession } from "@/app/lib/auth/session";
import { ApiError } from "@/app/lib/api/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await signup(body?.email, body?.password);

    // Log them straight in — making someone sign up and then immediately log in
    // with the credentials they just typed is friction for no security gain.
    await createSession(user.id);

    return NextResponse.json({ email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status }
      );
    }

    console.error("signup failed", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not create your account." } },
      { status: 500 }
    );
  }
}
