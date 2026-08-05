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

1. **Install dependencies** — `npm install`
2. **Compile the Compact contract** — `npm run compact`
3. **Sync ZK proving assets** — `npm run sync:assets`
4. **Start the dev server** — `npm run dev`
5. Open http://localhost:3000 with the 1AM wallet installed.

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

## Feedback & Iterations

Feedback from bidders, sellers, and reviewers is collected on every release and triaged
into the next iteration. Each shipped improvement is traceable to a feedback theme.

| Feedback theme | Iteration shipped |
|---|---|
| Bid state felt stale after being outbid and re-bidding | Loading state management + improved auction state fetching |
| Private state lost across browser sessions / role switches | Private state initialization hardening |
| Wallet SDK compatibility friction on Preprod | Updated package dependencies to current wallet SDKs |
| CI/build failures blocked shipping | Added CI pipeline + pinned Compact compiler |
| Claim flow needed a clearer privacy-boundary explanation | Documented privacy model + claim UI copy |
| Auto-close timing ambiguous | Documented `bidCount == maxBids` auto-close rule |

The full loop — verbatim user quotes, improvement-to-commit mapping, and the iteration
log — lives in [FEEDBACK.md](./FEEDBACK.md).

## Documentation

| File | Purpose |
|---|---|
| [README.md](./README.md) | Overview, setup, usage, architecture, privacy model |
| [FEEDBACK.md](./FEEDBACK.md) | Feedback loop: user quotes + the improvements each one triggered |
| [LAUNCH_USERS.md](./LAUNCH_USERS.md) | 70 Preprod user wallet addresses (Level 6 launch) |
| [PRIVATE-PARTY-SKILL.md](./PRIVATE-PARTY-SKILL.md) | Reusable skill definition for this dApp |

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run compact` | Re-compile Compact contract |
| `npm run sync:assets` | Copy ZK proving keys to `public/zk/` |

## Verification

- **CI status** — see badge at the top of this README. CI compiles the Compact contract,
  syncs ZK assets, and runs a production build on every push to `main`.
- **Contract on-chain** — query the Preprod indexer for contract
  `bc063667cdc2ad34df0079a96c9240739dff65a479c7aa412fe9642be85c55c0`.
- **ZK assets** — `npm run sync:assets` copies the proving keys from the compiled contract
  (`contract/src/managed/.../keys`) into `public/zk/...`.
- **Commit history** — `git log --oneline` lists the full iteration history; every shipped
  improvement in [FEEDBACK.md](./FEEDBACK.md) maps to a commit.

## Project Structure

```
├── README.md                          # Overview, setup, usage, architecture
├── FEEDBACK.md                        # Feedback loop + improvements log
├── LAUNCH_USERS.md                    # 70 Preprod user wallet addresses (Level 6)
├── PRIVATE-PARTY-SKILL.md             # Reusable skill definition
├── contract/src/
│   ├── private-reserve-auction.compact        # Compact smart contract
│   ├── index.ts                               # Compiled contract wrapper + exports
│   └── managed/private-reserve-auction/       # Compiled contract + ZK proving keys
├── lib/
│   ├── midnight.ts                      # Wallet session, providers, indexer polling
│   ├── auction.ts                       # Deploy, bid, close, reveal, claim
│   ├── address.ts                       # Bech32 → UserAddress bytes
│   ├── secret.ts                        # Generate/store secrets in localStorage
│   ├── sign-utils.mjs                   # Signature helpers
│   └── isomorphic-ws-fix.mjs            # WebSocket polyfill for Next.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # Landing page
│   └── auction/
│       ├── page.tsx                     # Server shell
│       └── AuctionClient.tsx            # Seller + bidder UI
├── public/zk/private-reserve-auction/   # ZK proving & verification keys
└── .github/workflows/ci.yml             # CI: compact → sync assets → build
```

## Target Network

**Preprod** (hardcoded in `AuctionClient.tsx`).
