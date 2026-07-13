import { withApiV1, preflight } from "@/app/lib/api/handler";
import { ApiError } from "@/app/lib/api/errors";
import { getWalletData, isValidAddress } from "@/app/lib/alchemy";
import { aggregatePortfolio } from "@/app/lib/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel's default is 10s, which 25 wallets will not finish inside. 60s is the
// ceiling on the Hobby plan; Pro allows more. If you raise MAX_ADDRESSES, raise
// this too — or the request dies half-way with no useful error.
export const maxDuration = 60;

// Each address fans out to ~4 upstream calls, and token metadata adds one more
// per token held. 25 is where a request still finishes inside Vercel's default
// serverless timeout on wallets with long histories.
const MAX_ADDRESSES = 25;

function parseAddresses(body: unknown): string[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("invalid_request", "Request body must be a JSON object.");
  }

  const { addresses } = body as { addresses?: unknown };

  if (!Array.isArray(addresses)) {
    throw new ApiError("invalid_request", "'addresses' must be an array.");
  }
  if (addresses.length === 0) {
    throw new ApiError("invalid_request", "'addresses' must not be empty.");
  }
  if (addresses.length > MAX_ADDRESSES) {
    throw new ApiError(
      "invalid_request",
      `'addresses' accepts at most ${MAX_ADDRESSES} entries, received ${addresses.length}.`
    );
  }

  for (const address of addresses) {
    if (typeof address !== "string" || !isValidAddress(address)) {
      throw new ApiError(
        "invalid_address",
        `'${String(address)}' is not a valid Ethereum address.`
      );
    }
  }

  // Same wallet twice would double-count it in the totals. Compare case-
  // insensitively, but echo back the FIRST spelling the caller used — they may
  // have sent a checksummed address and will match our response against it by
  // string equality.
  const seen = new Map<string, string>();
  for (const address of addresses as string[]) {
    const trimmed = address.trim();
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}

// POST /api/v1/portfolio  { "addresses": ["0x...", "0x..."] }
//
// Reject the whole request on a bad address (the caller made a mistake), but
// tolerate an upstream failure on any single wallet (we made a mistake, or
// Alchemy did) — the surviving wallets are still worth returning.
export const POST = withApiV1(async (request, _context, caller) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("invalid_request", "Request body is not valid JSON.");
  }

  const addresses = parseAddresses(body);
  const wallets = await Promise.all(
    addresses.map((address) => getWalletData(address, caller.alchemyKey))
  );

  return aggregatePortfolio(wallets);
});

// Answers the browser's CORS preflight so in-browser API explorers can call us.
export const OPTIONS = preflight;
