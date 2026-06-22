# WalletNest — Cross-Wallet Asset Tracker

Aggregate token balances, NFT holdings, and recent transactions across multiple
Ethereum wallets into one dashboard. Next.js + Alchemy. No smart contracts.

---

## Run it in VS Code (3 steps)

1. **Open the folder** in VS Code, then open a terminal (`` Ctrl+` ``).

2. **Get a free Alchemy API key**
   - Go to https://dashboard.alchemy.com → sign up (free).
   - Click **Create new app** → pick **Ethereum** + **Mainnet** → create.
   - Copy the **API Key** (not the URL — just the key).
   - Make a file named `.env.local` in this folder with one line:
     ```
     ALCHEMY_API_KEY=paste_your_key_here
     ```

3. **Install and run**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000. Paste a wallet address and press Enter.

   Test addresses (active wallets with lots of data):
   ```
   0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
   0x73bceb1cd57c711feac4224d062b0f6ff338501e
   0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
   0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0
   0x742d35Cc6634C0532925a3b844Bc454e4438f44e
   ```

---

## Deploy to Vercel (for your colleague)

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Before deploying, open **Environment Variables** and add:
   - Name: `ALCHEMY_API_KEY`
   - Value: your Alchemy key
4. Click **Deploy**. Done — Vercel gives you a live URL.

> Vercel auto-detects Next.js. No build settings to change. Every `git push`
> redeploys automatically.

---

## How it works (the short version)

```
Browser  →  /api/wallet/[address]  →  Alchemy API  →  Ethereum
(React)      (Next.js server route)    (RPC + data)     (blockchain)
```

- The **browser** never talks to Alchemy directly, so your API key stays secret.
- The **server route** (`app/api/wallet/[address]/route.ts`) fetches four things
  in parallel for each wallet: ETH balance, ERC-20 tokens, NFTs, transactions.
- Raw API responses get **normalized** into clean shapes (`app/lib/types.ts`)
  before they ever reach the UI.
- The dashboard **aggregates** totals across all added wallets.

## Folder map

```
app/
  api/wallet/[address]/route.ts   # server endpoint — calls Alchemy
  lib/
    types.ts                      # the normalized data shapes
    alchemy.ts                    # all fetching + normalization logic
    aggregate.ts                  # combine wallets + formatting helpers
  hooks/
    useWallets.ts                 # client state: add/remove/fetch wallets
  components/
    AddressInput.tsx              # the add-a-wallet bar
    StatStrip.tsx                 # top totals
    WalletCard.tsx                # per-wallet tokens / NFTs / txns
  page.tsx                        # the dashboard
  layout.tsx                      # html shell
  globals.css / dashboard.css     # styles
```

## Switching chains

In `app/lib/alchemy.ts`, change `Network.ETH_MAINNET` to `Network.MATIC_MAINNET`
(Polygon), `Network.BASE_MAINNET`, etc. Same API, different chain.
