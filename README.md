# Private Party RSVP DApp

A privacy-preserving party RSVP application on **Midnight Network** — attendees RSVP privately, then cross the **privacy boundary** when checking in with an unshielded NIGHT entry fee.

## Architecture

### Smart Contract (`contract/src/private-party.compact`)

| Circuit | Who | What it does |
|---|---|---|
| `constructor` | Organizer | Deploy with max guests, entry fee, and a secret |
| `rsvp` | Attendee | Privately commit via `persistentCommit` — only a hash stored on-chain |
| `startParty` | Organizer | Open the door for check-in (requires organizer secret) |
| `checkIn` | Attendee | Pay entry fee (unshielded NIGHT) → address becomes **public on ledger** |
| `closeEntry` | Organizer | Close doors early if not all checked in |
| `claimFees` | Organizer | Send total collected fees to organizer's unshielded address |

### Privacy Model

| Phase | On-chain data | Private? |
|---|---|---|
| RSVP | `persistentCommit(salt, address)` hash in `hashedPartyGoers` | **Yes** |
| Start | `partyState = STARTED` | State only, no identities |
| **Check in** | `receiveUnshielded` + `address` in `checkedInParty` | **No — privacy boundary** |
| Claim fees | `sendUnshielded` to organizer | **No** |

No `witness` declarations — authentication uses `persistentHash("private-party:pk:" + secret)` compared to stored `organizer` key, with domain separator.

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

**Organizer flow:**
1. Connect wallet → select "Organizer" → set max guests + entry fee → deploy
2. Share the contract address with attendees
3. Start party → guests can check in
4. Close doors → claim fees

**Attendee flow:**
1. Connect wallet → select "Attendee" → paste contract address
2. RSVP (private — only a hash goes on-chain)
3. After party starts: Check In (pays unshielded NIGHT, address becomes public)

Secrets are stored in `localStorage` per contract address. Use the same browser to manage your role.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Sync assets + production build |
| `npm run compact` | Re-compile Compact contract |
| `npm run sync:assets` | Copy ZK assets to `public/zk/` |

## Project Structure

```
├── contract/src/
│   ├── private-party.compact   # Compact smart contract
│   └── index.ts                # Compiled contract wrapper + exports
├── lib/
│   ├── midnight.ts             # Wallet session, providers, indexer polling
│   ├── party.ts                # Deploy, rsvp, checkIn, etc.
│   ├── address.ts              # Bech32 → UserAddress bytes
│   ├── secret.ts               # Generate/store secrets in localStorage
│   └── isomorphic-ws-fix.mjs   # WebSocket polyfill for Next.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── party/PartyClient.tsx   # Full organizer + attendee UI
├── public/zk/private-party/    # ZK proving & verification keys
└── scripts/sync-zk-assets.mjs
```

## Target Network

**Preview** (hardcoded in `PartyClient.tsx`). Change to `preprod` to target Preprod.
