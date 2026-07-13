import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GONE. This route predates the versioned API.
//
// It is not left as a working alias on purpose: it served the same wallet data
// with no authentication, so keeping it alive would be an open back door around
// the API key on /api/v1/wallets/{address}. A deprecation window is the right
// call for an endpoint with unknown consumers; this one only ever had one
// consumer — this repo's own dashboard — and it now calls /api/internal.
//
// Headers follow RFC 8594 (Sunset) and RFC 8288 (Link).
export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "not_found",
        message:
          "GET /api/wallet/{address} has been removed. Use GET /api/v1/wallets/{address} with an API key.",
      },
    },
    {
      status: 410,
      headers: {
        Deprecation: "true",
        Link: '</api/v1/openapi.json>; rel="describedby"',
      },
    }
  );
}
