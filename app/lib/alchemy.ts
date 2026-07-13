import type {
  WalletData,
  TokenBalance,
  NftItem,
  Transaction,
} from "./types";
import {
  ApiError,
  invalidAddress,
  invalidAlchemyKey,
  upstreamError,
} from "./api/errors";

// We call Alchemy's REST endpoints directly with fetch instead of the SDK.
// The SDK bundles an old ethers version that intermittently throws
// "missing response / SERVER_ERROR" on some setups. Plain fetch is reliable
// and behaves the same locally and on Vercel.
//
// The Alchemy key is a PARAMETER, not a module constant, because there are two
// sources for it:
//   - the dashboard uses the server's own key (process.env.ALCHEMY_API_KEY)
//   - /api/v1 callers bring their own, so they pay for their own usage
// Nothing in here should ever reach for the environment directly.

// Alchemy keys are interpolated straight into a URL path. A key containing
// `/` or `..` would rewrite that path and point our fetch somewhere else
// entirely — so a caller-supplied key is validated before it is ever used.
// Alchemy's own keys are URL-safe base64-ish; this range covers them.
const ALCHEMY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidAlchemyKey(key: string): boolean {
  return ALCHEMY_KEY_PATTERN.test(key);
}

function assertUsableKey(apiKey: string): void {
  if (!isValidAlchemyKey(apiKey)) {
    throw invalidAlchemyKey(
      "The supplied Alchemy key is malformed. Expected 16-64 characters of [A-Za-z0-9_-]."
    );
  }
}

const rpcUrl = (apiKey: string) =>
  `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;

// NFT API lives on a slightly different path.
const nftUrl = (apiKey: string) =>
  `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`;

// Alchemy answers a bad or revoked key with one of these. We surface it as the
// caller's problem (400), not ours (502) — retrying will never help them.
function rejectIfCredentialFailure(status: number): void {
  if (status === 401 || status === 403) {
    throw invalidAlchemyKey(
      "Alchemy rejected the API key you supplied. Check that it is active and permitted on Ethereum mainnet."
    );
  }
}

// Small helper: make a JSON-RPC POST call and return the `result` field.
// Retries automatically on transient 429/503 errors (Alchemy gets busy on
// wallets with very large histories).
async function rpc(
  apiKey: string,
  method: string,
  params: unknown[],
  attempt = 0
): Promise<any> {
  const res = await fetch(rpcUrl(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });

  rejectIfCredentialFailure(res.status);

  // Retry up to 3 times with a short backoff on rate-limit / busy errors.
  if ((res.status === 503 || res.status === 429) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    return rpc(apiKey, method, params, attempt + 1);
  }

  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || `RPC ${method} error`);
  return json.result;
}

// An Ethereum address is "0x" + 40 hex characters.
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

// Convert a hex wei string into a human ETH number.
function weiHexToEth(hex: string): number {
  return Number(BigInt(hex)) / 1e18;
}

// ---- 1. Native ETH balance ----
async function getNativeBalance(
  apiKey: string,
  address: string
): Promise<number> {
  const result = await rpc(apiKey, "eth_getBalance", [address, "latest"]);
  return weiHexToEth(result);
}

// ---- 2. ERC-20 token balances ----
async function getTokenBalances(
  apiKey: string,
  address: string
): Promise<TokenBalance[]> {
  // "erc20" tells Alchemy to return every ERC-20 the address has held.
  const data = await rpc(apiKey, "alchemy_getTokenBalances", [address, "erc20"]);

  const nonZero = (data.tokenBalances || []).filter(
    (t: any) =>
      t.tokenBalance &&
      t.tokenBalance !== "0x0" &&
      BigInt(t.tokenBalance) > 0n
  );

  // Fetch metadata (symbol/decimals/logo) for each token in parallel.
  const tokens = await Promise.all(
    nonZero.map(async (token: any) => {
      const meta = await rpc(apiKey, "alchemy_getTokenMetadata", [
        token.contractAddress,
      ]);
      const decimals = meta.decimals ?? 18;
      const balance = Number(BigInt(token.tokenBalance)) / Math.pow(10, decimals);

      return {
        contractAddress: token.contractAddress,
        symbol: meta.symbol ?? "???",
        name: meta.name ?? "Unknown Token",
        logo: meta.logo ?? null,
        balance,
        decimals,
      } satisfies TokenBalance;
    })
  );

  return tokens.sort((a, b) => b.balance - a.balance);
}

// ---- 3. NFT holdings ----
async function getNfts(apiKey: string, address: string): Promise<NftItem[]> {
  const url = `${nftUrl(apiKey)}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=20`;
  const res = await fetch(url, { cache: "no-store" });

  // A rejected key must not be silently swallowed into an empty gallery — the
  // caller would see a wallet with "no NFTs" instead of "your key is dead".
  rejectIfCredentialFailure(res.status);
  if (!res.ok) return [];

  const data = await res.json();

  return (data.ownedNfts || []).map((nft: any) => ({
    contractAddress: nft.contract?.address ?? "",
    tokenId: nft.tokenId ?? "0",
    title: nft.name || `#${nft.tokenId}`,
    collectionName: nft.contract?.name || "Unknown Collection",
    imageUrl: nft.image?.cachedUrl || nft.image?.originalUrl || null,
  }));
}

// ---- 4. Recent transactions ----
async function getTransactions(
  apiKey: string,
  address: string
): Promise<Transaction[]> {
  const categories = ["external", "erc20", "erc721", "erc1155"];

  const buildParams = (dir: "from" | "to") => [
    {
      fromBlock: "0x0",
      toBlock: "latest",
      [dir === "from" ? "fromAddress" : "toAddress"]: address,
      category: categories,
      withMetadata: false,
      excludeZeroValue: false,
      maxCount: "0xf", // 15 in hex
      order: "desc",
    },
  ];

  const [sent, received] = await Promise.all([
    rpc(apiKey, "alchemy_getAssetTransfers", buildParams("from")),
    rpc(apiKey, "alchemy_getAssetTransfers", buildParams("to")),
  ]);

  const map = (t: any, direction: "in" | "out"): Transaction => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    value: t.value ?? 0,
    asset: t.asset ?? "ETH",
    category: t.category,
    blockNum: t.blockNum,
    direction,
  });

  const all = [
    ...(sent.transfers || []).map((t: any) => map(t, "out")),
    ...(received.transfers || []).map((t: any) => map(t, "in")),
  ];

  return all
    .sort(
      (a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16)
    )
    .slice(0, 15);
}

// ---- Orchestrator: everything for ONE wallet, in parallel ----
//
// Two entry points, because the two callers want opposite things:
//
//   fetchWallet   throws on failure. The public API uses it, so a bad address
//                 becomes a 400 and an Alchemy outage becomes a 502 — the
//                 status code carries the meaning, as HTTP intends.
//
//   getWalletData never throws on a wallet-level failure. Batch callers use it,
//                 so one dead wallet in a portfolio of ten doesn't sink the
//                 other nine.
//
// Keeping both on one implementation means the public API and the dashboard
// can never drift apart in what a "wallet" actually contains.

export async function fetchWallet(
  address: string,
  apiKey: string
): Promise<WalletData> {
  assertUsableKey(apiKey);
  if (!isValidAddress(address)) throw invalidAddress(address);

  try {
    const [nativeBalance, tokens, nfts, transactions] = await Promise.all([
      getNativeBalance(apiKey, address),
      getTokenBalances(apiKey, address),
      getNfts(apiKey, address),
      getTransactions(apiKey, address),
    ]);

    return { address, nativeBalance, tokens, nfts, transactions };
  } catch (err) {
    // A bad key or a bad address is already the right error; don't bury it
    // under a generic 502 that tells the caller to retry forever.
    if (err instanceof ApiError) throw err;

    console.error(`Failed to load wallet ${address}:`, err);
    throw upstreamError();
  }
}

/**
 * Fault-tolerant wrapper: an upstream failure lands in the `error` field
 * rather than the stack.
 *
 * A rejected or malformed Alchemy key still throws, because that condition is
 * true for every wallet in the batch — reporting it 25 times as 25 separate
 * wallet failures would bury the one fact the caller needs.
 */
export async function getWalletData(
  address: string,
  apiKey: string
): Promise<WalletData> {
  try {
    return await fetchWallet(address, apiKey);
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.code === "invalid_alchemy_key" || err.code === "missing_alchemy_key")
    ) {
      throw err;
    }

    return {
      address,
      nativeBalance: 0,
      tokens: [],
      nfts: [],
      transactions: [],
      error: err instanceof Error ? err.message : "Failed to load wallet",
    };
  }
}
