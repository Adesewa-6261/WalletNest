import { NextResponse } from "next/server";
import { getSessionUserId } from "@/app/lib/auth/session";
import { createApiKey, listApiKeys } from "@/app/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser(): Promise<string | NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in first." } },
      { status: 401 }
    );
  }
  return userId;
}

// GET /api/keys — the caller's keys.
export async function GET() {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  const keys = await listApiKeys(userId);

  // key_hash never leaves the server. It is not the secret itself, but it is
  // the thing the server compares against, and there is no reason a browser
  // needs it.
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
      revokedAt: k.revoked_at,
    })),
  });
}

// POST /api/keys — mint a key. The plaintext is in THIS response and nowhere
// else, ever again.
export async function POST(request: Request) {
  const userId = await requireUser();
  if (typeof userId !== "string") return userId;

  let name: unknown = "";
  try {
    name = (await request.json())?.name;
  } catch {
    // An empty or unparseable body is fine — the key just gets a default name.
  }

  const { row, plaintext } = await createApiKey(userId, name);

  return NextResponse.json(
    {
      key: {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        createdAt: row.created_at,
      },
      // Shown once. We store only the hash, so we cannot show it again — and a
      // "reveal key" feature would require storing the secret, which is exactly
      // what we're avoiding.
      plaintext,
    },
    { status: 201 }
  );
}
