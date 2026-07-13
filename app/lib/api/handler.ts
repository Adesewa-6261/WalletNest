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
  };
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
      const caller = authenticate(request);
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
