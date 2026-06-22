"use client";

import type { WalletData } from "../lib/types";
import { shortenAddress, formatNumber } from "../lib/aggregate";

interface Props {
  wallet: WalletData;
  onRemove: (address: string) => void;
}

export default function WalletCard({ wallet, onRemove }: Props) {
  if (wallet.error) {
    return (
      <div className="wallet-card">
        <div className="wallet-head">
          <span className="addr">{shortenAddress(wallet.address)}</span>
          <button className="remove" onClick={() => onRemove(wallet.address)}>
            ×
          </button>
        </div>
        <div className="wallet-err">⚠ {wallet.error}</div>
      </div>
    );
  }

  return (
    <div className="wallet-card">
      <div className="wallet-head">
        <span className="addr">{shortenAddress(wallet.address)}</span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="bal">
            {formatNumber(wallet.nativeBalance)} ETH
          </span>
          <button className="remove" onClick={() => onRemove(wallet.address)}>
            ×
          </button>
        </div>
      </div>

      <div className="wallet-body">
        {/* Tokens */}
        <div className="panel">
          <h3>
            Tokens <span className="count">{wallet.tokens.length}</span>
          </h3>
          {wallet.tokens.length === 0 && (
            <div className="empty">No ERC-20 tokens</div>
          )}
          {wallet.tokens.slice(0, 6).map((t) => (
            <div className="row" key={t.contractAddress}>
              <div className="left">
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="token-logo" src={t.logo} alt="" />
                ) : (
                  <div className="token-logo" />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="sym">{t.symbol}</div>
                  <div className="name">{t.name}</div>
                </div>
              </div>
              <span className="amt">{formatNumber(t.balance)}</span>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div className="panel">
          <h3>
            Recent activity{" "}
            <span className="count">{wallet.transactions.length}</span>
          </h3>
          {wallet.transactions.length === 0 && (
            <div className="empty">No recent transactions</div>
          )}
          {wallet.transactions.slice(0, 6).map((tx, i) => (
            <div className="row" key={`${tx.hash}-${i}`}>
              <div className="left">
                <span className={`dir ${tx.direction}`}>
                  {tx.direction === "in" ? "in" : "out"}
                </span>
                <span className="tx-hash">{shortenAddress(tx.hash)}</span>
              </div>
              <span className="amt">
                {formatNumber(tx.value)}{" "}
                {tx.asset && tx.asset.length > 8
                  ? tx.asset.slice(0, 8) + "…"
                  : tx.asset}
              </span>
            </div>
          ))}
        </div>

        {/* NFTs — full width strip */}
        <div className="panel span-full">
          <h3>
            NFTs <span className="count">{wallet.nfts.length}</span>
          </h3>
          {wallet.nfts.length === 0 ? (
            <div className="empty">No NFTs held</div>
          ) : (
            <div className="nft-grid">
              {wallet.nfts.map((nft) => (
                <div
                  className="nft"
                  key={`${nft.contractAddress}-${nft.tokenId}`}
                  title={`${nft.collectionName} — ${nft.title}`}
                >
                  {nft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nft.imageUrl} alt={nft.title} />
                  ) : (
                    <div className="ph">#{nft.tokenId.slice(0, 4)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
