import { NextResponse } from "next/server";
import { getSessionUserId } from "@/app/lib/auth/session";
import { revokeApiKey } from "@/app/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/keys/{id} — revoke. Takes effect on the very next API request:
// key verification reads the database every time and is deliberately uncached.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first." } },
      { status: 401 }
    );
  }

  // revokeApiKey scopes the UPDATE to this user, so a key belonging to someone
  // else is indistinguishable from one that doesn't exist. That is deliberate:
  // a different response would confirm the key's existence to a stranger.
  const revoked = await revokeApiKey(userId, params.id);

  if (!revoked) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No such active key." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
