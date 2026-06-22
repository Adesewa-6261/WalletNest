"use client";

import { useEffect, useState } from "react";

interface Props {
  onLaunch: () => void;
}

// Counts a number up from 0 to target on mount.
function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// Sample holdings that scroll inside the phone.
const PHONE_TOKENS = [
  { sym: "ETH", name: "Ethereum", amt: "12.84", val: "$41,208", up: true, color: "#627eea" },
  { sym: "USDC", name: "USD Coin", amt: "18,920", val: "$18,920", up: true, color: "#2775ca" },
  { sym: "WBTC", name: "Wrapped BTC", amt: "0.91", val: "$58,114", up: true, color: "#f09242" },
  { sym: "LINK", name: "Chainlink", amt: "840", val: "$12,180", up: false, color: "#2a5ada" },
  { sym: "UNI", name: "Uniswap", amt: "1,210", val: "$9,438", up: true, color: "#ff007a" },
  { sym: "AAVE", name: "Aave", amt: "94", val: "$8,742", up: true, color: "#b6509e" },
  { sym: "ARB", name: "Arbitrum", amt: "5,400", val: "$4,860", up: false, color: "#28a0f0" },
  { sym: "PEPE", name: "Pepe", amt: "82.1M", val: "$3,690", up: true, color: "#4caf50" },
];

export default function Landing({ onLaunch }: Props) {
  const wallets = useCountUp(1284);
  const assets = useCountUp(57000);

  return (
    <div className="lp">
      {/* animated floating background */}
      <div className="lp-bg" aria-hidden="true">
        <span className="lp-blob lp-blob-1" />
        <span className="lp-blob lp-blob-2" />
        <span className="lp-blob lp-blob-3" />
        <span className="lp-coin lp-coin-1">Ξ</span>
        <span className="lp-coin lp-coin-2">◈</span>
        <span className="lp-coin lp-coin-3">◆</span>
        <span className="lp-coin lp-coin-4">$</span>
        <span className="lp-coin lp-coin-5">⬡</span>
        <span className="lp-coin lp-coin-6">◇</span>
        <span className="lp-ring lp-ring-1" />
        <span className="lp-ring lp-ring-2" />
      </div>

      <nav className="lp-nav">
        <div className="lp-logo">
          <span className="lp-logo-mark">◆</span>
          WalletNest
        </div>
        <button className="lp-nav-btn" onClick={onLaunch}>
          Open app
        </button>
      </nav>

      <div className="lp-hero">
        <div className="lp-hero-text">
          <div className="lp-badge">
            <span className="lp-pulse" />
            Live on-chain data
          </div>

          <h1 className="lp-title">
            All your wallets,
            <br />
            <span className="lp-accent">one clear view.</span>
          </h1>

          <p className="lp-sub">
            Aggregate token balances, NFTs, and transaction history across every
            wallet address you own into a single real-time portfolio. No
            sign-up, no wallet connection. Just paste and track.
          </p>

          <div className="lp-cta-row">
            <button className="lp-cta" onClick={onLaunch}>
              Launch tracker
              <span className="lp-cta-arrow">→</span>
            </button>
            <div className="lp-cta-note">Free · No account needed</div>
          </div>

          <div className="lp-stats">
            <div className="lp-stat">
              <div className="lp-stat-num">
                {Math.round(wallets).toLocaleString()}
              </div>
              <div className="lp-stat-label">Wallets tracked</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">
                {Math.round(assets).toLocaleString()}+
              </div>
              <div className="lp-stat-label">Assets indexed</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">Live</div>
              <div className="lp-stat-label">Real-time sync</div>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="lp-phone-wrap">
          <div className="lp-phone">
            <div className="lp-phone-notch" />
            <div className="lp-phone-screen">
              <div className="lp-app-head">
                <div className="lp-app-label">Total balance</div>
                <div className="lp-app-total">$152,160</div>
                <div className="lp-app-change">▲ 4.2% today</div>
              </div>

              <div className="lp-app-tabs">
                <span className="lp-tab lp-tab-on">Tokens</span>
                <span className="lp-tab">NFTs</span>
                <span className="lp-tab">Activity</span>
              </div>

              <div className="lp-scroll-mask">
                <div className="lp-scroll-track">
                  {[...PHONE_TOKENS, ...PHONE_TOKENS].map((t, i) => (
                    <div className="lp-token-row" key={i}>
                      <div
                        className="lp-token-icon"
                        style={{ background: t.color }}
                      >
                        {t.sym[0]}
                      </div>
                      <div className="lp-token-id">
                        <div className="lp-token-sym">{t.sym}</div>
                        <div className="lp-token-name">{t.name}</div>
                      </div>
                      <div className="lp-token-vals">
                        <div className="lp-token-val">{t.val}</div>
                        <div className="lp-token-amt">
                          {t.amt} {t.sym}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="lp-phone-glow" />
        </div>
      </div>

      {/* Features */}
      <div className="lp-features">
        <div className="lp-feature">
          <div className="lp-feature-icon">◈</div>
          <h3>Token balances</h3>
          <p>
            Every ERC-20 across all your wallets, fetched live and normalized
            into clean, sorted holdings.
          </p>
        </div>
        <div className="lp-feature">
          <div className="lp-feature-icon">▦</div>
          <h3>NFT gallery</h3>
          <p>
            A visual grid of every collectible each wallet holds, with artwork
            pulled straight from the chain.
          </p>
        </div>
        <div className="lp-feature">
          <div className="lp-feature-icon">⇄</div>
          <h3>Live activity</h3>
          <p>
            Recent incoming and outgoing transfers, merged and sorted across
            every address in real time.
          </p>
        </div>
      </div>
    </div>
  );
}
