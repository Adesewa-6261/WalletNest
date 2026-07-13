import { withApiV1, preflight } from "@/app/lib/api/handler";
import { fetchWallet } from "@/app/lib/alchemy";

// node:crypto (timing-safe key comparison) is unavailable on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wallets with very long token histories fan out to a lot of metadata calls.
export const maxDuration = 30;

// GET /api/v1/wallets/0x123...
// Bring-your-own-key: the chain data is fetched with the caller's Alchemy key.
export const GET = withApiV1<{ address: string }>(
  async (_request, { params }, caller) =>
    fetchWallet(params.address.trim(), caller.alchemyKey)
);

// Answers the browser's CORS preflight so in-browser API explorers can call us.
export const OPTIONS = preflight;
