import { NextResponse } from "next/server";
import { getWalletData } from "@/app/lib/alchemy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint backs the dashboard UI. It is NOT part of the public API and
// carries no version guarantee — see /api/v1/* for that.
//
// It is deliberately unauthenticated, because it has to be: the dashboard is a
// public page with no user accounts, so whatever key it held would ship to the
// browser and be readable in devtools. An API key in a client bundle is not a
// secret. The same-origin check below stops other sites embedding this
// endpoint; it does NOT stop a direct curl, and it is not a substitute for
// rate limiting.
//
// Consequence, stated plainly: this route spends your Alchemy quota for any
// anonymous caller who finds it. Before this goes anywhere public, put an
// IP-based rate limiter in front of it (Vercel KV, Upstash, or the platform's
// own firewall rules). Authenticating /api/v1 does not protect the quota on
// its own.
function isSameOrigin(request: Request): boolean {
  // Browsers send this on same-origin fetches and it cannot be spoofed by
  // page JavaScript. Non-browser clients omit it entirely, so absence is
  // allowed — this is a cross-site embedding guard, not an auth check.
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed on internal endpoints." },
      { status: 403 }
    );
  }

  // The dashboard's visitors have no Alchemy key of their own, so this route —
  // unlike /api/v1 — spends the deployment's key. It is the only place that
  // reads ALCHEMY_API_KEY.
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.error("ALCHEMY_API_KEY is unset — the dashboard cannot load data.");
    return NextResponse.json(
      { error: "This deployment is not configured to load wallet data." },
      { status: 503 }
    );
  }

  // Returns `{ ...wallet, error? }` rather than a status code, because the
  // dashboard renders a failed wallet as a card with an error on it.
  //
  // The exception is a dead or malformed server key: getWalletData throws that
  // rather than folding it into `error`, because it is an operator problem, not
  // a wallet problem. Don't echo the reason to the browser — it describes our
  // own credential.
  try {
    const data = await getWalletData(params.address.trim(), apiKey);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Dashboard wallet lookup failed:", err);
    return NextResponse.json(
      { error: "This deployment is not configured to load wallet data." },
      { status: 503 }
    );
  }
}
