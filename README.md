# WalletNest — Cross-Wallet Asset Tracker

A cross-wallet crypto asset tracker that aggregates tokens, NFTs, and transactions into a single portfolio dashboard. Built with Next.js + Alchemy. No smart contracts — read-only access to on-chain data.

## Features

- Track multiple Ethereum wallet addresses at once
- Aggregated ERC-20 token balances across all wallets
- NFT holdings displayed in a visual gallery
- Recent transaction history, merged and sorted
- Portfolio-style dashboard with totals
- Fully responsive (desktop + mobile)

## Getting started

1. Get a free API key from [Alchemy](https://dashboard.alchemy.com) — create an app on Ethereum Mainnet and copy the API key.

2. Create a `.env.local` file in the project root:
ALCHEMY_API_KEY=your_api_key_here
3. Install dependencies and run:
```bash
   npm install
   npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000), paste a wallet address, and press Enter.

## How it works
Browser  →  /api/wallet/[address]  →  Alchemy API  →  Ethereum

(React)      (Next.js server route)    (RPC + data)     (blockchain)

The browser never calls Alchemy directly — a Next.js server route handles all requests, keeping the API key server-side. For each wallet, the route fetches the ETH balance, ERC-20 tokens, NFTs, and recent transactions in parallel, then normalizes the raw blockchain data into clean, consistent shapes before it reaches the UI. The dashboard aggregates totals across every wallet added.

## Tech stack

- **Next.js** + **React** + **TypeScript** — frontend and server routes
- **Alchemy API** — RPC queries, token, NFT, and transaction data

## Project structure
app/

api/wallet/[address]/   server endpoint that calls Alchemy

lib/                    data fetching, normalization, helpers

hooks/                  client-side wallet state

components/             UI components

page.tsx                dashboard

layout.tsx              app shell
## License

MIT
