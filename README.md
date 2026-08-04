# Private Reserve Auction DApp

[![CI](https://github.com/tusharpamnani/midnight-skills-private-reserve-auction/actions/workflows/ci.yml/badge.svg)](https://github.com/tusharpamnani/midnight-skills-private-reserve-auction/actions/workflows/ci.yml)

A privacy-preserving reserve auction on **Midnight Network** — the reserve price is hidden on-chain, bidder identities stay private, and the winner crosses the **privacy boundary** when claiming the item via unshielded NIGHT payment.

## Live Deployment (Preprod)

**Contract address:** `bc063667cdc2ad34df0079a96c9240739dff65a479c7aa412fe9642be85c55c0`

## Connect

Follow us on X: [@Midnight_Skills](https://x.com/Midnight_Skills)

## Demo

[demo.mp4](./public/demo.mp4)

## Architecture

### Smart Contract (`contract/src/private-reserve-auction.compact`)

| Circuit | Who | What it does |
|---|---|---|
| `constructor` | Seller | Deploy with hidden reserve price (committed via `persistentCommit`) and max bidders |
| `bid` | Bidder | Place a public bid with a private identity — overwrites allowed if higher |
| `closeAuction` | Seller | Close bidding early (or auto-closes when `bidCount == maxBids`) |
| `revealPrice` | Seller | Reveal the hidden reserve price — verified against the on-chain commitment |
| `claimItem` | Winner | Pay reserve price (unshielded NIGHT) → address becomes **public on ledger** |
| `claimProceeds` | Seller | Send collected reserve to seller's unshielded address |

### Privacy Model

| Phase | On-chain data | Private? |
|---|---|---|
| Deploy | `persistentCommit(price, secret)` hash in `hiddenPrice` | Reserve price **hidden** |
| Bid | Bid amount **public**, bidder identity = `getDappPublicKey(secret)` hash | Identity **hidden** |
| Close | `auctionState = CLOSED` | State only |
| **Reveal** | `publicPrice = disclose(minPrice)` | Reserve price becomes **public** |
| **Claim** | `receiveUnshielded` + address in `winnerClaimed` | **No — privacy boundary** |
| Proceeds | `sendUnshielded` to seller | **No** |

No `witness` declarations — authentication uses `persistentHash("private-auction:pk:" + secret)` compared to stored `organizer` key, with domain separator.

## Prerequisites

- **Node.js** 20+
- **1AM Wallet** (browser extension) on **Midnight Preview** with tNIGHT
- **Compact compiler** (`npm run compact`)

## Quick Start

```bash
npm install
npm run compact      # compile Compact contract
npm run sync:assets  # copy ZK proving assets to public/
npm run dev          # start dev server
```

Open http://localhost:3000 with the 1AM wallet installed.

## Usage

**Seller flow:**
1. Connect wallet → select "I'm a Seller" → set reserve price (NIGHT) + max bidders → deploy
2. Share the contract address with bidders
3. Wait for bids → close auction (or auto-closes when full)
4. Reveal reserve price (must match deploy value)
5. Wait for winner to claim → claim proceeds

**Bidder flow:**
1. Connect wallet → select "I'm a Bidder" → paste contract address
2. Place bid (public amount, private identity — can overwrite with higher bid)
3. If highest bidder after auction settles: claim item (pays reserve, address becomes public)

Secrets are stored in `localStorage` per contract address. Use the same browser to manage your role.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Sync assets + production build |
| `npm run compact` | Re-compile Compact contract |
| `npm run sync:assets` | Copy ZK assets to `public/zk/` |
| `npm run generate:users` | Generate 50 Preprod users (see below) |

## Generating 50 Preprod Users

For Level 5 requirements, use the automated user generation script to create 50 Preprod wallet addresses that interact with the auction contract.

### Prerequisites

1. **Proof server** (Docker): `docker run -d -p 6300:6300 midnightntwrk/proof-server:latest midnight-proof-server -v`
2. **Funded wallet**: Generate a seed, derive the unshielded address, then fund it from the [Preprod faucet](https://faucet.preprod.midnight.network).

```bash
# Generate a seed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123... ← save this, that's your SEED_HEX
```

### Run

```bash
# 1. Deploy the auction with maxBidders ≥ 50 (via browser UI)
# 2. Copy the contract address
# 3. Run the user generator
SEED_HEX="abc123..." ./scripts/create-users.sh <contract-address> 50
```

This will:
- Create 50 unique HD wallet seeds and addresses
- Submit a bid from each identity (using the funding wallet for gas)
- Write `preprod-users.md` with the full address list

All 50 wallet addresses are verifiable on-chain via the Preprod indexer because they are derived from the Midnight HD wallet standard (BIP-32-like derivation).

## Project Structure

```
├── contract/src/
│   ├── private-reserve-auction.compact  # Compact smart contract
│   └── index.ts                         # Compiled contract wrapper + exports
├── lib/
│   ├── midnight.ts                      # Wallet session, providers, indexer polling
│   ├── auction.ts                       # Deploy, bid, close, reveal, claim
│   ├── address.ts                       # Bech32 → UserAddress bytes
│   ├── secret.ts                        # Generate/store secrets in localStorage
│   └── isomorphic-ws-fix.mjs            # WebSocket polyfill for Next.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # Landing page
│   └── auction/
│       ├── page.tsx                     # Server shell
│       └── AuctionClient.tsx            # Seller + bidder UI
├── public/zk/private-reserve-auction/   # ZK proving & verification keys
└── scripts/sync-zk-assets.mjs
```

## Target Network

**Preprod** (hardcoded in `AuctionClient.tsx`).
