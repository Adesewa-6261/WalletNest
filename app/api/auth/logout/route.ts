import { NextResponse } from "next/server";
import { destroySession } from "@/app/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST, not GET: a logout on GET can be triggered by any <img> tag pointing at
// it, which lets another site sign your users out for fun.
export async function POST() {
  destroySession();
  return NextResponse.json({ ok: true });
}
