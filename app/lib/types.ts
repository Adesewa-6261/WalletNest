// All data from the Alchemy API gets normalized into THESE shapes.
// The rest of the app only ever touches these types, never raw API responses.

export interface TokenBalance {
  contractAddress: string;
  symbol: string;
  name: string;
  logo: string | null;
  balance: number; // already divided by decimals — human readable
  decimals: number;
}

export interface NftItem {
  contractAddress: string;
  tokenId: string;
  title: string;
  collectionName: string;
  imageUrl: string | null;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: number; // in ETH, human readable
  asset: string; // "ETH", "USDC", etc.
  category: string; // "external", "erc20", "erc721"...
  blockNum: string;
  direction: "in" | "out";
}

// Everything we know about ONE wallet, normalized.
export interface WalletData {
  address: string;
  nativeBalance: number; // ETH balance
  tokens: TokenBalance[];
  nfts: NftItem[];
  transactions: Transaction[];
  error?: string; // set if this wallet failed to load
}

// The combined view across ALL wallets — what the dashboard renders.
export interface AggregatedPortfolio {
  wallets: WalletData[];
  totalNativeBalance: number;
  totalTokenCount: number;
  totalNftCount: number;
  totalTransactionCount: number;
}
