"use client";

import { useState, useCallback } from "react";
import type { WalletData, AggregatedPortfolio } from "../lib/types";
import { aggregatePortfolio } from "../lib/aggregate";

// This hook owns ALL the wallet state for the page:
//  - the list of addresses the user added
//  - the fetched data for each
//  - loading / error flags
// Components just call addWallet / removeWallet and read the results.
export function useWallets() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addWallet = useCallback(
    async (rawAddress: string) => {
      const address = rawAddress.trim();
      if (!address) return;

      // Don't add the same wallet twice.
      if (
        wallets.some((w) => w.address.toLowerCase() === address.toLowerCase())
      ) {
        setError("That wallet is already on the dashboard.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/wallet/${address}`);
        if (!res.ok) throw new Error("Request failed");
        const data: WalletData = await res.json();
        setWallets((prev) => [...prev, data]);
      } catch (err) {
        setError("Could not load that wallet. Check the address and try again.");
      } finally {
        setLoading(false);
      }
    },
    [wallets]
  );

  const removeWallet = useCallback((address: string) => {
    setWallets((prev) => prev.filter((w) => w.address !== address));
  }, []);

  const portfolio: AggregatedPortfolio = aggregatePortfolio(wallets);

  return { wallets, portfolio, loading, error, addWallet, removeWallet };
}
