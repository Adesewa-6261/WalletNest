import type {
  WalletData,
  TokenBalance,
  NftItem,
  Transaction,
} from "./types";

// We call Alchemy's REST endpoints directly with fetch instead of the SDK.
// The SDK bundles an old ethers version that intermittently throws
// "missing response / SERVER_ERROR" on some setups. Plain fetch is reliable
// and behaves the same locally and on Vercel.

const API_KEY = process.env.ALCHEMY_API_KEY;
const BASE = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;
// NFT API lives on a slightly different path.
const NFT_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${API_KEY}`;

// Small helper: make a JSON-RPC POST call and return the `result` field.
// Retries automatically on transient 429/503 errors (Alchemy gets busy on
// wallets with very large histories).
async function rpc(method: string, params: unknown[], attempt = 0): Promise<any> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });

  // Retry up to 3 times with a short backoff on rate-limit / busy errors.
  if ((res.status === 503 || res.status === 429) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    return rpc(method, params, attempt + 1);
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
async function getNativeBalance(address: string): Promise<number> {
  const result = await rpc("eth_getBalance", [address, "latest"]);
  return weiHexToEth(result);
}

// ---- 2. ERC-20 token balances ----
async function getTokenBalances(address: string): Promise<TokenBalance[]> {
  // "erc20" tells Alchemy to return every ERC-20 the address has held.
  const data = await rpc("alchemy_getTokenBalances", [address, "erc20"]);

  const nonZero = (data.tokenBalances || []).filter(
    (t: any) =>
      t.tokenBalance &&
      t.tokenBalance !== "0x0" &&
      BigInt(t.tokenBalance) > 0n
  );

  // Fetch metadata (symbol/decimals/logo) for each token in parallel.
  const tokens = await Promise.all(
    nonZero.map(async (token: any) => {
      const meta = await rpc("alchemy_getTokenMetadata", [
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
async function getNfts(address: string): Promise<NftItem[]> {
  const url = `${NFT_BASE}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=20`;
  const res = await fetch(url, { cache: "no-store" });
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
async function getTransactions(address: string): Promise<Transaction[]> {
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
    rpc("alchemy_getAssetTransfers", buildParams("from")),
    rpc("alchemy_getAssetTransfers", buildParams("to")),
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
export async function getWalletData(address: string): Promise<WalletData> {
  if (!isValidAddress(address)) {
    return {
      address,
      nativeBalance: 0,
      tokens: [],
      nfts: [],
      transactions: [],
      error: "Invalid Ethereum address",
    };
  }

  try {
    const [nativeBalance, tokens, nfts, transactions] = await Promise.all([
      getNativeBalance(address),
      getTokenBalances(address),
      getNfts(address),
      getTransactions(address),
    ]);

    return { address, nativeBalance, tokens, nfts, transactions };
  } catch (err) {
    console.error(`Failed to load wallet ${address}:`, err);
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
