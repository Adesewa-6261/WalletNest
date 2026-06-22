"use client";

import type { AggregatedPortfolio } from "../lib/types";
import { formatNumber } from "../lib/aggregate";

export default function StatStrip({ p }: { p: AggregatedPortfolio }) {
  const stats = [
    { label: "Total ETH", value: formatNumber(p.totalNativeBalance), unit: "ETH" },
    { label: "Tokens", value: String(p.totalTokenCount), unit: "" },
    { label: "NFTs", value: String(p.totalNftCount), unit: "" },
    { label: "Wallets", value: String(p.wallets.length), unit: "" },
  ];

  return (
    <div className="stats">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <div className="label">{s.label}</div>
          <div className="value">
            {s.value}
            {s.unit && <span className="unit">{s.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
