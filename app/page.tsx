"use client";

import { useState } from "react";
import { useWallets } from "./hooks/useWallets";
import Landing from "./components/Landing";
import AddressInput from "./components/AddressInput";
import StatStrip from "./components/StatStrip";
import WalletCard from "./components/WalletCard";

export default function Home() {
  // Which screen are we on: the landing page or the dashboard?
  const [launched, setLaunched] = useState(false);

  const { wallets, portfolio, loading, error, addWallet, removeWallet } =
    useWallets();

  // Show the landing page first.
  if (!launched) {
    return <Landing onLaunch={() => setLaunched(true)} />;
  }

  // Once launched, show the dashboard (your original, untouched).
  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1>WalletNest</h1>
          <div className="tag">
            <span className="live-dot" />
            Ethereum Mainnet · Live RPC
          </div>
        </div>
        <div className="masthead-actions">
          {/* Set NEXT_PUBLIC_DOCS_URL on Vercel once Mintlify is live. Until
              then this link is hidden rather than pointing at a 404. */}
          {process.env.NEXT_PUBLIC_DOCS_URL && (
            <a
              className="home-link"
              href={process.env.NEXT_PUBLIC_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              API docs ↗
            </a>
          )}
          <button className="home-link" onClick={() => setLaunched(false)}>
            ← Back to home
          </button>
        </div>
      </header>

      <AddressInput onAdd={addWallet} loading={loading} />

      {error && <div className="notice">{error}</div>}

      {wallets.length > 0 && <StatStrip p={portfolio} />}

      {loading && <div className="skeleton" />}

      {wallets.length === 0 && !loading ? (
        <div className="blank">
          <div className="big">No wallets yet</div>
          <div className="small">
            Add an address above to aggregate its assets.
          </div>
        </div>
      ) : (
        wallets.map((w) => (
          <WalletCard key={w.address} wallet={w} onRemove={removeWallet} />
        ))
      )}
    </main>
  );
}
