import type { WalletData, AggregatedPortfolio } from "./types";

// Takes the per-wallet data and rolls it up into the totals the
// dashboard header shows.
export function aggregatePortfolio(
  wallets: WalletData[]
): AggregatedPortfolio {
  const valid = wallets.filter((w) => !w.error);

  return {
    wallets,
    totalNativeBalance: valid.reduce((sum, w) => sum + w.nativeBalance, 0),
    totalTokenCount: valid.reduce((sum, w) => sum + w.tokens.length, 0),
    totalNftCount: valid.reduce((sum, w) => sum + w.nfts.length, 0),
    totalTransactionCount: valid.reduce(
      (sum, w) => sum + w.transactions.length,
      0
    ),
  };
}

// 0x1234abcd...5678 — shorten long addresses for display.
export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Trim long decimals: 1.23456789 -> 1.2346, but keep small values readable.
export function formatNumber(n: number): string {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
