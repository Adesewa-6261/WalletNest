// Every error the public API can return, as a stable machine-readable code.
// Clients branch on `code`. Messages are for humans and may be reworded.
export type ApiErrorCode =
  | "unauthorized"
  | "invalid_address"
  | "invalid_request"
  | "missing_alchemy_key"
  | "invalid_alchemy_key"
  | "not_found"
  | "upstream_error"
  | "internal_error"
  | "server_misconfigured";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  invalid_address: 400,
  invalid_request: 400,
  // 4xx, not 5xx: the caller supplied a credential we couldn't use. Nothing on
  // our side is broken, and retrying the same request will fail identically.
  missing_alchemy_key: 400,
  invalid_alchemy_key: 400,
  not_found: 404,
  upstream_error: 502,
  internal_error: 500,
  server_misconfigured: 503,
};

// Anything thrown inside a route handler that isn't an ApiError becomes a
// generic 500 — we never leak an unexpected stack trace to a caller.
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export const invalidAddress = (address: string) =>
  new ApiError(
    "invalid_address",
    `'${address}' is not a valid Ethereum address. Expected '0x' followed by 40 hex characters.`
  );

export const upstreamError = () =>
  new ApiError(
    "upstream_error",
    "Could not reach the chain data provider. Try again shortly."
  );

export const missingAlchemyKey = () =>
  new ApiError(
    "missing_alchemy_key",
    "This endpoint requires your own Alchemy API key. Send it as 'X-Alchemy-Key: <key>'. Get one free at https://dashboard.alchemy.com."
  );

export const invalidAlchemyKey = (reason: string) =>
  new ApiError("invalid_alchemy_key", reason);
