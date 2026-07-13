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

WalletNest is API-first: the public, versioned, authenticated API is the product, and the dashboard is one of its consumers.

```
                     ┌─ /api/v1/*        (API key + caller's own Alchemy key)
       service    ← ─┤
                     └─ /api/internal/*  (no key, same-origin, powers the dashboard)
```

Both surfaces call one service layer (`app/lib/alchemy.ts`), so the API and the UI can never disagree about what a wallet contains. They differ only in *whose* Alchemy key pays for the data.

The service exposes two entry points: `fetchWallet` throws (the public API turns those throws into 400/502 status codes) and `getWalletData` folds wallet failures into an `error` field (batch callers keep the wallets that succeeded). Neither reads `process.env` — the Alchemy key is always a parameter.

### Bring your own key

`/api/v1` callers must send their own Alchemy key as `X-Alchemy-Key`. They pay for their own chain data, and no amount of API traffic can drain your Alchemy quota.

Two credentials, two jobs: the WalletNest key (`Authorization: Bearer wnk_…`) grants *access*; the Alchemy key pays for *data*. Access is checked first.

The caller's key is interpolated into a request URL, so it's validated against `^[A-Za-z0-9_-]{16,64}$` before it's ever used — otherwise a key like `abc/../../evil.com/x` would rewrite the URL. It is never logged or cached.

### Why the dashboard doesn't call `/api/v1`

An API key shipped to a browser is not a secret — it sits in the bundle, readable in devtools. The dashboard is a public page with no user accounts, so it cannot hold one, and its visitors have no Alchemy key of their own. It calls `/api/internal/*` instead, which is unauthenticated by necessity and uses **your** `ALCHEMY_API_KEY`.

> [!WARNING]
> `/api/internal/*` is the one route that spends your Alchemy quota, and any anonymous caller who finds it can spend it. There is **no rate limiting** anywhere in this codebase. Put an IP-based limiter in front of it before this is publicly reachable. `/api/v1` is safe from this by construction — it spends the caller's key, not yours.

## The API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/v1/wallets/{address}` | API key + Alchemy key | One wallet: balance, tokens, NFTs, transfers |
| `POST /api/v1/portfolio` | API key + Alchemy key | Up to 25 wallets, aggregated |
| `GET /api/v1/openapi.json` | none | The OpenAPI 3.1 spec |
| `GET /api/internal/wallet/{address}` | none | Dashboard only. Not a public contract. |
| `GET /api/wallet/{address}` | — | **410 Gone.** Replaced by `/api/v1/wallets/{address}`. |

```bash
curl https://your-app.vercel.app/api/v1/wallets/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  -H "Authorization: Bearer wnk_live_..." \
  -H "X-Alchemy-Key: your_alchemy_key"
```

### API keys

Keys are static and stored as SHA-256 hashes in `WALLETNEST_API_KEYS`. The server never holds a plaintext key.

```bash
npm run generate-key          # prints the secret key + the hash to store
```

Fails **closed**: with no keys configured, `/api/v1` returns `503` rather than serving data openly.

The honest limits of this approach — worth knowing before you build on it:

- Revoking a key means editing the env var and redeploying. No instant kill switch.
- A key is a boolean. No owner, no quota, no scopes, no usage tracking.

Moving keys into Vercel KV or Postgres fixes all three; only `allowedHashes` in `app/lib/api/auth.ts` has to change.

## Documentation

The docs site is [Mintlify](https://mintlify.com), in `docs/`. It reads `docs/openapi.json` — the *same file* `/api/v1/openapi.json` serves — so the reference cannot drift from the API.

```bash
npm run docs:dev              # http://localhost:3000 (Mintlify's own dev server)
```

> [!NOTE]
> Mintlify is **not** deployed to Vercel. It is hosted by Mintlify, connected to this repo via their GitHub app, and deploys on push. Vercel hosts the app; Mintlify hosts the docs. Two targets.

## Deploying

**App → Vercel.** Set both environment variables:

```bash
vercel env add ALCHEMY_API_KEY
vercel env add WALLETNEST_API_KEYS
vercel deploy --prod
```

Then update the `servers` block in `docs/openapi.json` to your real domain — it currently points at a placeholder.

**Docs → Mintlify.** Install the [Mintlify GitHub app](https://dashboard.mintlify.com), point it at `docs/`, and it builds on every push to the default branch.

## Tech stack

- **Next.js** + **React** + **TypeScript** — frontend and server routes
- **Alchemy API** — RPC queries, token, NFT, and transaction data
- **OpenAPI 3.1** — the API contract, hand-maintained in `docs/openapi.json`
- **Mintlify** — documentation site

## Project structure

```
app/
  api/v1/                   public, versioned, API-key authed
    wallets/[address]/      single wallet
    portfolio/              batch aggregation
    openapi.json/           serves the spec (public)
  api/internal/             dashboard-only, unauthenticated
  api/wallet/[address]/     410 Gone — legacy
  lib/
    api/                    error envelope, key auth, route wrapper
    alchemy.ts              the service layer, shared by both surfaces
    aggregate.ts            portfolio rollups
  hooks/                    client-side wallet state
  components/               UI components
docs/                       Mintlify site + openapi.json (source of truth)
scripts/generate-api-key.mjs
```

## License

MIT
