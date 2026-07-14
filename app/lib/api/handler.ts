import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate, type AuthenticatedCaller } from "./auth";
import { ApiError, missingAlchemyKey } from "./errors";

export const API_VERSION = "v1";

type RouteContext<TParams> = { params: TParams };

/** What a v1 handler is given once both credentials check out. */
export interface V1Caller extends AuthenticatedCaller {
  /**
   * The caller's own Alchemy key. v1 is bring-your-own-key: the caller pays
   * for their own chain data, so no amount of API traffic can drain this
   * deployment's Alchemy quota. Never log this — it is someone else's secret.
   */
  alchemyKey: string;
}

type Handler<TParams> = (
  request: Request,
  context: RouteContext<TParams>,
  caller: V1Caller
) => Promise<unknown>;

// Format validation happens in the service layer, immediately before the key is
// interpolated into a URL. Here we only require that one was sent at all.
function requireAlchemyKey(request: Request): string {
  const key = request.headers.get("x-alchemy-key")?.trim();
  if (!key) throw missingAlchemyKey();
  return key;
}

function baseHeaders(requestId: string): Record<string, string> {
  return {
    "X-Request-Id": requestId,
    "X-API-Version": API_VERSION,
    // Wallet data changes every block; never let a CDN or browser hold it.
    "Cache-Control": "no-store",
    ...CORS_HEADERS,
  };
}

// Allow cross-origin calls so browser-based API explorers (the docs playground,
// Swagger UI, Postman's web client) can reach v1 directly.
//
// This is safe *because* auth is header-based, not cookie-based: a browser
// cannot smuggle a credential it doesn't already have, and we never send
// Access-Control-Allow-Credentials. Anyone calling from a browser has already
// chosen to expose their own key — which the docs tell them not to do.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, X-Alchemy-Key, Content-Type",
  "Access-Control-Max-Age": "86400",
  // Let a browser client read the request id when reporting a failure.
  "Access-Control-Expose-Headers": "X-Request-Id, X-API-Version",
};

/**
 * Preflight handler. Browsers send OPTIONS before any request carrying custom
 * headers (which ours all do), and will abort if it isn't answered with the
 * matching Allow-* headers. Unauthenticated by necessity — a preflight cannot
 * carry credentials.
 */
export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Wraps a v1 route handler with the concerns every public endpoint shares:
 * a request id, API-key authentication, a uniform error envelope, and version
 * headers. The handler just returns its payload and throws ApiError to fail.
 *
 * Pinned to the Node runtime — `authenticate` uses node:crypto's
 * timingSafeEqual, which the edge runtime does not provide.
 */
export function withApiV1<TParams = Record<string, string>>(
  handler: Handler<TParams>
) {
  return async (
    request: Request,
    context: RouteContext<TParams>
  ): Promise<NextResponse> => {
    const requestId = randomUUID();

    try {
      const caller = await authenticate(request);
      const alchemyKey = requireAlchemyKey(request);
      const payload = await handler(request, context, {
        ...caller,
        alchemyKey,
      });
      return NextResponse.json(payload, { headers: baseHeaders(requestId) });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, requestId } },
          { status: err.status, headers: baseHeaders(requestId) }
        );
      }

      // Unexpected. Log the real thing, tell the caller nothing about it.
      console.error(`[${requestId}] unhandled error`, err);
      return NextResponse.json(
        {
          error: {
            code: "internal_error",
            message: "An unexpected error occurred.",
            requestId,
          },
        },
        { status: 500, headers: baseHeaders(requestId) }
      );
    }
  };
}
