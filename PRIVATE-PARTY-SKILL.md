---
name: example-private-party-dapp
author: Kali-Decoder
description: >
  Build a private party RSVP dApp on Midnight Network — attendees stay private until
  unshielded NIGHT check-in crosses the privacy boundary. Covers private-party.compact
  (no witnesses, persistentCommit, DApp-specific public keys, receiveUnshielded/sendUnshielded),
  Next.js frontend, 1AM wallet integration, low-level deploy/call, indexer polling, and
  optional vitest local devnet tests. Use for teaching privacy boundaries, commitment-based
  guest lists, organizer access control, or unshielded entry fees. Triggers: private party,
  RSVP dApp, privacy boundary, persistentCommit, getDappPublicKey, unshielded check-in,
  example-private-party, party organizer, guest list commitment. Also use when extending
  locker-dapp or payment-dapp wallet/provider patterns to privacy-preserving social flows.
---

# Midnight Network Private Party DApp

A **private party contract** lets an organizer collect RSVPs while attendee identities stay private until guests **check in** and pay the entry fee in **unshielded NIGHT**. That payment is the **privacy boundary** — unshielded token flows are always public on Midnight.

**Runnable template:** Copy `templates/private-party-dapp/` for a complete Next.js project (contract + UI). Run `npm install && npm run compact && npm run sync:assets && npm run dev` after installing the [1AM wallet](https://1am.dev).

**Official reference:** `github.com/midnightntwrk/example-private-party` — Compact tutorial + vitest harness (`yarn test:local` on Docker devnet).

**What this skill produces:**
- `contract/` — `private-party.compact` (no witnesses) + compile scripts
- `app/party/` — Next.js client UI (organizer deploy/start/close/claim + attendee RSVP/check-in)
- `lib/midnight.ts` — wallet session + patched indexer provider (**copy from** `references/midnight-session.md` or `templates/private-party-dapp/lib/midnight.ts`)
- `lib/party.ts` — deploy, `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`, ledger decode
- `lib/address.ts` — Bech32 unshielded address → `{ bytes: Uint8Array }` for `UserAddress` circuit args
- `lib/secret.ts` — generate/store 32-byte DApp secrets in `localStorage`
- `public/zk/private-party/` — ZK proving assets synced from contract build

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/midnight-session.md` — `createConnectedSession`, indexer patch, deploy/call helpers
- `references/gotchas.md` — preprod deploy hangs, GraphQL `offset: null`, ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-locker-dapp/` / `templates/locker-dapp/` — Next.js + 1AM, low-level deploy/call
- `example-payment-dapp/` — unshielded `receiveUnshielded` / `sendUnshielded` patterns
- `example-hello-world/` — vitest + Docker devnet test harness (test script provided in official repo)
- `compact/` — `disclose()`, `persistentCommit`, `persistentHash`, `Set`, sealed ledger, enums
- `security/` — privacy boundary checklist, what becomes public and when
- `token-transfers/` — unshielded NIGHT units (Stars), Bech32 address decoding

**Key architecture notes:**
- **No witnesses** — caller auth uses circuit-private `_secret` → `getDappPublicKey(_secret)` compared to on-chain `organizer`
- **RSVP privacy** — guest `UserAddress` + secret committed via `persistentCommit`; only the hash is stored in `hashedPartyGoers`
- **Privacy boundary** — `checkIn` calls `receiveUnshielded(nativeToken(), entryFee)` then `checkedInParty.insert(disclose(address))` — guest address becomes public
- **Organizer becomes public** — `claimFees` calls `sendUnshielded(...)` to organizer's `UserAddress`
- **`disclose()` is a developer assertion** — it marks values safe for public domains; it does not perform the disclosure itself
- **`persistentCommit` output is safe on ledger without `disclose()`** — sufficiently random salt (`_secret`) required
- Use `createUnprovenDeployTx` + `submitTxAsync` — not `deployContract()` (hangs on preprod)
- Wrap `indexerPublicDataProvider` with patched `queryContractState` (GraphQL `offset: null` bug)
- Entry fee is `Uint<16>` on ledger but cast to `Uint<128>` for unshielded ops; 1 NIGHT = 1_000_000 Stars
- Persist organizer/attendee `_secret` in `localStorage` — losing it means losing auth for that role

---

## Workflow

When helping the user, follow this sequence:

1. **Contract** — write `private-party.compact` by hand (tutorial focus); compile with `yarn compile`
2. **Understand privacy boundary** — private RSVP → public check-in (unshielded) → public payout
3. **Providers** — `createConnectedSession` (from `references/midnight-session.md`)
4. **Deploy** — organizer passes `(partySize, entryFee, organizerSecret)` to constructor
5. **RSVP** — attendees call `rsvp(userAddress, secret)` before party starts
6. **Start** — organizer calls `startParty(secret)` when ready (or auto when list full → `READY`)
7. **Check in** — RSVP'd guests call `checkIn(address, secret)` + pay entry fee (crosses boundary)
8. **Close** — organizer `closeEntry(secret)` if not everyone checked in; or auto when full
9. **Claim** — organizer `claimFees(organizerAddress, secret)` after doors closed
10. **UI** — role picker, party status panel, indexer polling for public state

---

## 1) Project Structure

```
private-party-dapp/
├── package.json
├── next.config.mjs
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   ├── party.ts                    # deploy, circuits, decode state
│   ├── address.ts                  # Bech32 → UserAddress bytes
│   └── secret.ts                   # crypto.getRandomValues + localStorage
├── app/
│   ├── layout.tsx
│   └── party/
│       └── PartyClient.tsx         # organizer + attendee UI
├── contract/
│   ├── package.json
│   └── src/
│       ├── private-party.compact
│       ├── index.ts                # CompiledContract.withVacantWitnesses
│       └── managed/private-party/  # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs          # → public/zk/private-party/
└── public/zk/private-party/        # keys + zkir (gitignored until sync)
```

**Optional test harness** (official repo — not in browser template):

```
example-private-party/
├── contract/private-party.compact
├── src/test/party.test.ts          # vitest: Alice organizer, Bob/Claire guests
├── compose.yml                     # node + indexer + proof-server
└── package.json                    # yarn test:local
```

---

## 2) Prerequisites

```bash
node --version   # 22+ for vitest harness; 20+ for Next.js frontend
docker --version # optional local devnet tests

curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
```

Browser: **1AM wallet** on `preprod` with tNIGHT for entry fees.

---

## 3) Root `package.json`

```json
{
  "name": "private-party-dapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --webpack",
    "build": "npm run sync:assets && next build --webpack",
    "compact": "npm run compact --prefix contract",
    "sync:assets": "node scripts/sync-zk-assets.mjs",
    "postinstall": "npm install --prefix contract"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0",
    "@midnight-ntwrk/ledger-v8": "8.0.3",
    "@midnight-ntwrk/midnight-js-contracts": "4.0.4",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-network-id": "4.0.4",
    "@midnight-ntwrk/midnight-js-types": "4.0.4",
    "@midnight-ntwrk/wallet-sdk-address-format": "3.1.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 4) `contract/package.json`

```json
{
  "name": "@private-party/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile src/private-party.compact src/managed/private-party"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  }
}
```

Compile:

```bash
npm run compact
# → contract/src/managed/private-party/{contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-party/
```

Expected circuits: `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`.

---

## 5) `contract/src/private-party.compact`

Write this file **by hand** following the tutorial — do not copy-paste without understanding each circuit.

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

export enum PartyState {
    NOT_STARTED,
    READY,
    STARTED,
    DOORS_CLOSED,
    FEES_CLAIMED
}

export sealed ledger organizer: Bytes<32>;
export sealed ledger maxListSize: Uint<16>;
export sealed ledger entryFee: Uint<16>;
export ledger partyState: PartyState;
export ledger hashedPartyGoers: Set<Bytes<32>>;
export ledger checkedInParty: Set<UserAddress>;

constructor (partySize: Uint<16>, fee: Uint<16>, _secret: Bytes<32>) {
    assert(partySize > 0, "The party size must be greater than zero");
    assert(fee > 0, "Fee must be greater than zero");

    const pubKey = getDappPublicKey(_secret);
    organizer = disclose(pubKey);

    entryFee = disclose(fee);
    maxListSize = disclose(partySize);
    partyState = PartyState.NOT_STARTED;
}

export circuit rsvp(_address: UserAddress, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(pubKey != organizer, "Organizer cannot RSVP to the party");
    assert(partyState == PartyState.NOT_STARTED, "The party has already started");
    assert(hashedPartyGoers.size() < maxListSize, "The list is full");

    const commitHash = commitAddress(_secret, _address.bytes);
    assert(!hashedPartyGoers.member(commitHash), "You are already on the list");
    hashedPartyGoers.insert(commitHash);

    if (hashedPartyGoers.size() == maxListSize) {
        partyState = PartyState.READY;
    }
}

export circuit startParty(_secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only the organizer can start the party");
    assert(partyState == PartyState.READY || partyState == PartyState.NOT_STARTED,
        "The party is not in the correct state for this operation");

    partyState = PartyState.STARTED;
}

export circuit checkIn(address: UserAddress, _secret: Bytes<32>): [] {
    assert(partyState == PartyState.STARTED, "The party has not been started. Call the party police");
    assert(checkedInParty.size() < hashedPartyGoers.size(), "All guests have already checked in");

    const commitHash = commitAddress(_secret, address.bytes);

    assert(hashedPartyGoers.member(commitHash), "You are not on the list");
    assert(!checkedInParty.member(disclose(address)), "You have already checked in");

    // Privacy boundary: unshielded payment makes guest address public
    receiveUnshielded(nativeToken(), entryFee as Uint<128>);
    checkedInParty.insert(disclose(address));

    if (checkedInParty.size() == maxListSize) {
        partyState = PartyState.DOORS_CLOSED;
    }
}

export circuit closeEntry(_secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only organizer can close the doors");
    assert(partyState == PartyState.STARTED, "Party in wrong state");

    partyState = PartyState.DOORS_CLOSED;
}

export circuit claimFees(address: UserAddress, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "You are not the organizer");

    assert(partyState == PartyState.DOORS_CLOSED, "The doors are not yet closed");
    assert(checkedInParty.size() > 0, "No fees to claim");

    const totalCollected = checkedInParty.size() * entryFee;
    assert(unshieldedBalanceGte(nativeToken(), totalCollected), "Contract balance wrong");

    sendUnshielded(
        nativeToken(),
        disclose(totalCollected) as Uint<128>,
        right<ContractAddress, UserAddress>(disclose(address))
    );
    partyState = PartyState.FEES_CLAIMED;
}

circuit commitAddress(_address: Bytes<32>, _secret: Bytes<32>): Bytes<32> {
    return persistentCommit<Bytes<32>>(_address, _secret);
}

circuit getDappPublicKey(_secret: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "private-party:pk:"), _secret]);
}
```

### Privacy model summary

| Phase | Attendee identity | On-chain data |
|---|---|---|
| RSVP | Private | Commitment hash in `hashedPartyGoers` only |
| Before check-in | Private | Hash count visible; no addresses |
| Check-in | **Public** | `receiveUnshielded` + address in `checkedInParty` |
| Claim fees | Organizer **public** | `sendUnshielded` to organizer address |

### Always-public Compact domains

- Ledger fields (after `disclose()` or safe commits)
- Circuit return values from exported circuits
- Contract-to-contract calls
- **Unshielded token transfers** (`receiveUnshielded`, `sendUnshielded`)

---

## 6) `contract/src/index.ts`

No witnesses — use `withVacantWitnesses`. **Use lazy `await import()` pattern** to avoid SSR issues and ensure `CompiledContract` is resolved from the correct module.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { sampleSigningKey, ContractState } from '@midnight-ntwrk/compact-runtime';

let _contractModule: any = null;
let _compiledContract: any = null;
let _ledgerFn: any = null;

export async function getCompiledContract(zkPath?: string): Promise<any> {
  if (!_compiledContract) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-party/contract/index.js');
    }
    _compiledContract = CompiledContract.make(
      'private-party',
      _contractModule.Contract,
    );
    _compiledContract = CompiledContract.withVacantWitnesses(_compiledContract);
  }
  return _compiledContract;
}

export async function getLedger(): Promise<any> {
  if (!_ledgerFn) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-party/contract/index.js');
    }
    _ledgerFn = _contractModule.ledger;
  }
  return _ledgerFn;
}

export { sampleSigningKey, ContractState };
```

Key changes from earlier versions:
- `CompiledContract` imported from `@midnight-ntwrk/compact-js` (not `compact-runtime`)
- Lazy singleton pattern (`getCompiledContract`, `getLedger`) — avoids dual-instance WASM identity bug
- `ContractState.deserialize(fromHex(action.state))` exported for indexer state decoding
- `sampleSigningKey` re-exported for deploy txs

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args. The `{ bytes: Uint8Array }` format is required by the `contractModule` — native `UserAddress` in the compiled contract.

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

export function bech32ToUserAddress(bech32: string, networkId: string): { bytes: Uint8Array } {
  const parsed = MidnightBech32m.parse(bech32).decode(UnshieldedAddress, networkId);
  return { bytes: new Uint8Array(parsed.data) };
}
```

Never pass raw Bech32 strings or shielded coin public keys where `UserAddress` is expected. The `{ bytes }` wrapper is required for `UserAddress` but **not** for `Bytes<32>` — those are raw `Uint8Array`.

---

## 8) `lib/secret.ts`

```typescript
import { toHex, fromHex } from './midnight';

export function generateSecret(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function saveSecret(role: 'organizer' | 'attendee', contractAddress: string, secret: Uint8Array) {
  localStorage.setItem(`private-party:${role}:${contractAddress}`, toHex(secret));
}

export function loadSecret(role: 'organizer' | 'attendee', contractAddress: string): Uint8Array | null {
  const hex = localStorage.getItem(`private-party:${role}:${contractAddress}`);
  return hex ? fromHex(hex) : null;
}
```

---

## 9) Provider Setup — `lib/midnight.ts`

Copy or generate this file. Key requirements:

- `ConnectedSession` type
- `createConnectedSession` (ZK path → `/zk/private-party/`)
- `createPrivateStateProvider()` — in-memory Map-based, no @midnight-ntwrk dependency
- `createPatchedPublicDataProvider(queryUrl, subscriptionUrl)` — handles GraphQL `offset: null` bug by issuing raw fetch with direct query
- `pollForState()` — custom retry loop using the same patched query
- `coinPublicKeyToBytes()` — normalizes multiple formats: `Uint8Array`, hex `string`, `Array<number>`, or `{ bytes: ... }`, all normalized to 32 bytes
- `detectWallet()` — prefer `window.midnight['1am']`, fallback to first enumerated wallet
- `fromHex` / `toHex` utility functions

The patched `queryContractState` method is essential — the default provider from `@midnight-ntwrk/midnight-js-indexer-public-data-provider` throws `offset: null` errors on the preview/preprod indexer.

The `coinPublicKeyToBytes` helper is needed because `getShieldedAddresses()` returns different formats depending on wallet version.

---

## 10) `lib/party.ts`

Uses `getCompiledContract()` (lazy singleton) and the correct arg format for Compact 0.23+.

```typescript
import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { getCompiledContract, getLedger, sampleSigningKey, ContractState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { fromHex, pollForState } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivatePartyState';
export const ZK_PATH = '/zk/private-party';

const PARTY_STATE_NAMES = [
  'NOT_STARTED',
  'READY',
  'STARTED',
  'DOORS_CLOSED',
  'FEES_CLAIMED',
] as const;

function setSize(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => number)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

export async function deployParty(
  session: ConnectedSession,
  partySize: number,
  entryFeeStars: number,
  organizerSecret: Uint8Array,
): Promise<string> {
  const cc = await getCompiledContract();
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: cc,
      args: [BigInt(partySize), BigInt(entryFeeStars), organizerSecret],
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
      signingKey: sampleSigningKey(),
    },
  );

  const contractAddress = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {});
  await session.providers.privateStateProvider.setSigningKey(
    contractAddress,
    deployTxData.private.signingKey,
  );
  return contractAddress;
}

export async function rsvp(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId: 'rsvp',
    args: [userAddress, attendeeSecret],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function startParty(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId: 'startParty',
    args: [organizerSecret],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function checkIn(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId: 'checkIn',
    args: [userAddress, attendeeSecret],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function closeEntry(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId: 'closeEntry',
    args: [organizerSecret],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function claimFees(
  session: ConnectedSession,
  contractAddress: string,
  organizerAddress: { bytes: Uint8Array },
  organizerSecret: Uint8Array,
) {
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId: 'claimFees',
    args: [organizerAddress, organizerSecret],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function decodePartyState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = await getLedger();
  const l = ledger(contractState.data) as any;
  const stateIdx = Number(l.partyState);
  return {
    partyState: PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`,
    partyStateIndex: stateIdx,
    maxListSize: Number(l.maxListSize),
    entryFee: Number(l.entryFee),
    rsvpCount: setSize(l.hashedPartyGoers),
    checkedInCount: setSize(l.checkedInParty),
  };
}

export async function fetchPartyState(queryUrl: string, contractAddress: string) {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodePartyState(hex);
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.config.networkId);
}
```

**Key differences from earlier versions:**
- `args` use `BigInt(...)` for `Uint<16>` fields, not plain numbers
- `Bytes<32>` args are passed as raw `Uint8Array`, **not** wrapped in `{ bytes: ... }`
- `ContractState.deserialize` is imported from `contract/src/index` which re-exports from `@midnight-ntwrk/compact-runtime`
- `ledger()` is called via `getLedger()` using the contract's own module — not a static import
- `setSize()` helper handles both `.size` property and `.size()` method on `Set` ledger values

---

## 11) Frontend — `app/party/PartyClient.tsx`

Client component pattern (same as locker/payment dapps). Core UI states:

| Role | State | UI |
|---|---|---|
| Any | Wallet disconnected | Connect button |
| Organizer | Connected, no contract | Deploy form (max guests, entry fee in Stars) |
| Organizer | Deployed, NOT_STARTED/READY | Start party; show RSVP count |
| Organizer | STARTED | Close doors (if guests remain) |
| Organizer | DOORS_CLOSED | Claim fees |
| Attendee | Has contract address | RSVP (generates + stores secret) |
| Attendee | STARTED + prior RSVP | Check in (pays entry fee — **privacy boundary**) |
| Any | After check-in | Public guest list from `checkedInParty` on indexer |

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  checkIn,
  claimFees,
  closeEntry,
  deployParty,
  fetchPartyState,
  rsvp,
  startParty,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/party';
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';

type Role = 'organizer' | 'attendee';

export default function PartyClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('attendee');
  const [contractAddress, setContractAddress] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [entryFee, setEntryFee] = useState('5');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchPartyState>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setStatus(await fetchPartyState(session.config.indexerUri, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function onConnect() {
    setBusy(true);
    setError(null);
    try {
      const wallet = await detectWallet();
      const api = await wallet.connect('preprod');
      setSession(await createConnectedSession(api, ZK_PATH));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeploy() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const secret = generateSecret();
      const addr = await deployParty(
        session,
        Number(partySize),
        Number(entryFee),
        secret,
      );
      setContractAddress(addr);
      saveSecret('organizer', addr, secret);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRsvp() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    try {
      let secret = loadSecret('attendee', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('attendee', contractAddress, secret);
      }
      await rsvp(session, contractAddress, userAddressFromSession(session), secret);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ... startParty, checkIn, closeEntry, claimFees handlers mirror lib/party.ts
  // Organizer claimFees: userAddressFromSession(session) + loadSecret('organizer', contractAddress)

  return (
    <div>
      <h1>Private Party</h1>
      <p>Attendees stay private until check-in pays unshielded NIGHT.</p>
      {!session ? (
        <button type="button" onClick={onConnect} disabled={busy}>Connect Wallet</button>
      ) : (
        <>
          <p>Connected: {session.unshieldedAddress}</p>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="organizer">Organizer</option>
              <option value="attendee">Attendee</option>
            </select>
          </label>
          <label>
            Contract address
            <input value={contractAddress} onChange={(e) => setContractAddress(e.target.value.trim())} />
          </label>
          {status ? (
            <p>
              State: {status.partyState} · RSVPs: {status.rsvpCount}/{status.maxListSize} ·
              Checked in: {status.checkedInCount} · Fee: {status.entryFee} Stars
            </p>
          ) : null}
          {/* Role-specific action buttons */}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

Add styling as needed — see full implementation in `templates/private-party-dapp/app/party/PartyClient.tsx`.

---

## 12) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

```javascript
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract/src/managed/private-party');
const dest = join(root, 'public/zk/private-party');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const dir of ['keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
```

Verify: `http://localhost:3000/zk/private-party/keys/rsvp.prover` returns 200.

---

## 13) Local Devnet Tests (Official Repo)

The tutorial test script is **provided** in `example-private-party` — focus on writing Compact by hand, then run:

```bash
git clone git@github.com:midnightntwrk/example-private-party.git
cd example-private-party
yarn install
yarn compile
yarn env:up          # Docker: node + indexer + proof-server
yarn test:local      # vitest party.test.ts
```

Expected flow (11 tests):
1. Deploy contract (Alice organizer)
2. Bob RSVPs privately
3. Alice (organizer) rejected from RSVP
4. Claire RSVPs
5. Bob rejected from startParty
6. Alice starts party
7. Bob checks in → becomes public
8. Bob rejected from closeEntry
9. Alice closes doors
10. Alice claimFees → NIGHT balance increases by `checkedInCount * entryFee`
11. Hard-way deploy test

Read `/src/test/party.test.ts` for MidnightJS provider patterns with `FluentWalletBuilder`.

---

## 14) End-to-End Browser Flow

```
1. npm install && npm run compact && npm run sync:assets
2. npm run dev
3. Organizer: Connect 1AM → Deploy (max 2 guests, fee 5 Stars) → copy contract address
4. Attendee (other browser/wallet): Connect → paste address → RSVP
5. Organizer: Start party (or wait until RSVP list full → READY)
6. Attendee: Check in (wallet pays 5 Stars unshielded — address now public on ledger)
7. Organizer: Close doors (if needed) → Claim fees to unshielded address
8. Poll indexer — verify checkedInCount and partyState transitions
```

### Tailwind v4 Dark-Only Theme Setup

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: #7c3aed;
  --color-brand-hover: #6d28d9;
  --color-surface: #1a1a2e;
  --color-card: #16213e;
  --color-border: #2a2a4a;
  --color-muted: #9ca3af;
  --color-success: #16a34a;
  --color-danger: #dc2626;
}
```

```tsx
/* app/layout.tsx */
<body className="bg-[#0f0f23] text-zinc-100 antialiased">{children}</body>
```

No light theme — body has a deep navy bg and all components use dark surface/card tones via `bg-surface`, `bg-card`, `bg-[#1e1e38]` hover states, and `text-zinc-100`/`text-zinc-300`/`text-muted` hierarchy.

---

## 15) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Organizer cannot RSVP` | Organizer secret used for RSVP | Use separate attendee secret |
| `You are not on the list` | Wrong secret or address at check-in | Same `_secret` + `UserAddress` as RSVP |
| `The party has already started` | RSVP after startParty | RSVP only in NOT_STARTED |
| `Only the organizer can start` | Wrong organizer secret | Reload from `localStorage` or redeploy |
| `Contract balance wrong` | Fee mismatch or partial check-ins | Verify `entryFee * checkedInCount` |
| `Invalid character 'm' at position 0` | Bech32 passed as bytes | Use `bech32ToUserAddress()` |
| Deploy hangs 30–120s | Used `deployContract()` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| GraphQL `offset: null` | Default indexer provider | Use patched `queryContractState` |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| Lost organizer secret | No recovery on-chain | Redeploy contract; store secret in localStorage |
| `CompiledContract.withVacantWitnesses` TypeScript error | `@midnight-ntwrk/compact-runtime` vs `@midnight-ntwrk/compact-js` mismatch | Import `CompiledContract` from `@midnight-ntwrk/compact-js`, not `@midnight-ntwrk/compact-runtime` |
| `ContractMaintenanceAuthority` WASM identity error | Dual `@midnight-ntwrk/compact-runtime` instances (contract-local `node_modules` + root) | Delete `contract/node_modules` so webpack resolves one copy from root |
| `makeCompiledContract` not a function | Static import of `CompiledPrivatePartyContract` fails in browser | Use lazy `await import(...)` and singleton pattern |
| `bigint` type mismatch on constructor args | Passed `number` where `bigint` expected | Wrap in `BigInt(value)`. The Compact contract expects `bigint` for `Uint<16>` ledger fields |
| `Bytes<32>` wrapped in `{ bytes: ... }` mismatch | Skill shows `{ bytes: organizerSecret }` but runtime accepts raw `Uint8Array` | Pass raw `Uint8Array` — no `{ bytes }` wrapper needed for `Bytes<32>` args in Compact 0.23+ |
| `ContractState.deserialize` import not found | Imported from wrong package | Import `ContractState` from `@midnight-ntwrk/compact-runtime` |
| `ContractState.deserialize` argument type mismatch | Passed `state` from GraphQL directly | `ContractState.deserialize(fromHex(action.state))` — receives a `Uint8Array`, not a hex string |
| `ledger()` is not a function | `ContractState.deserialize(...).data` must be decoded via the contract's own `ledger()` | Call `contractModule.ledger(contractState.data)` — exported from `contract/src/managed/private-party/contract/index.js` |
| `isomorphic-ws` not found in webpack | Next.js can't resolve WASM/WebSocket deps of Midnight SDK | Add `resolve.fallback` entries (`fs`, `net`, `tls`, `child_process`) and alias `isomorphic-ws` → `lib/isomorphic-ws-fix.mjs` |
| `pipeline is not a function` | Missing `stream` polyfill for Node built-ins in browser | Add `stream: require.resolve('stream-browserify')` to webpack `resolve.fallback` |
| `tailwindcss v4` not applied | Missing PostCSS config for `@tailwindcss/postcss` | Use `postcss.config.mjs` with `plugins: { '@tailwindcss/postcss': {} }` and `globals.css` with `@import "tailwindcss"` + `@theme {}` block |
| `Tailwind v4 bg-white` stays white in dark mode | No dark mode variant — only bg classes applied | Set `body` class to `bg-[#0f0f23] text-zinc-100` (no light theme); use dark-adjusted surface/card/border/muted theme values |
| Input/select text invisible on dark bg | `bg-white text-zinc-900` on inputs in dark context | Use `bg-surface text-zinc-100` for inputs; adjust `placeholder:text-zinc-500` |
| `size()` not a function on Set ledger fields | Contract-compiled Set has `.size` property (number), not method | Check both: `value.size` (number) or `value.size()` (method). Use `setSize()` helper that handles both |
| `npm run build` times out or hangs | Next.js static generation tries to resolve Midnight SDK's Node deps | Add `unoptimized: true` in `next.config.mjs` or ensure all WASM/stream polyfills are in `resolve.fallback` |
| Network: `preprod` vs `preview` mismatch | Skill says `wallet.connect('preprod')` but target is Preview | Use `wallet.connect('preview')` |

---

## 16) Agent Checklist

When generating this dApp for a user:

- [ ] Write `private-party.compact` with all six exported circuits + helper circuits
- [ ] Compile; sync ZK assets to `public/zk/private-party/`
- [ ] Use `CompiledContract.withVacantWitnesses` imported from `@midnight-ntwrk/compact-js` (not `compact-runtime`)
- [ ] Lazy `getCompiledContract()` / `getLedger()` singleton pattern (avoid dual WASM instance bug)
- [ ] Wire `createConnectedSession` with patched indexer
- [ ] Constructor args: `[BigInt(partySize), BigInt(entryFeeStars), rawUint8Array]` — no `{ bytes }` wrapper for `Bytes<32>`, but `{ bytes }` wrapper IS needed for `UserAddress`
- [ ] Decode unshielded Bech32 via `wallet-sdk-address-format`
- [ ] Store organizer/attendee secrets in `localStorage` per contract address
- [ ] UI explains privacy boundary before check-in button
- [ ] Next.js: `asyncWebAssembly: true` + `topLevelAwait: true` in webpack config; `resolve.fallback` for `fs`, `net`, `tls`, `child_process`; alias `isomorphic-ws`
- [ ] Delete `contract/node_modules` if present — root-level `node_modules` must be the sole `compact-runtime` copy
- [ ] Delete `contract/package.json` or set `postinstall` to no-op — all deps at root
- [ ] Document: entry fee in Stars; check-in uses unshielded NIGHT
- [ ] Tailwind v4 dark-only: `@import "tailwindcss"` + `@theme {}` + `postcss.config.mjs` with `@tailwindcss/postcss` plugin

---

## 17) Extensions

### Shielded entry fees

To keep attendees private through payment, rework `checkIn` to use shielded tokens instead of `receiveUnshielded` — see tutorial conclusion and `token-transfers/` skill.

### Multi-party testing UI

Add "copy invite link" with contract address query param; show public `checkedInParty` addresses after boundary crossed.

### Headless CI

Port official `party.test.ts` into the template monorepo using `example-hello-world/` Docker compose pattern.

---

## 18) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Unshielded token flows | `token-transfers/` |
| Payment vault pattern | `example-payment-dapp/` |
| Privacy audit | `security/` |
| Compact language reference | `compact/` |
| Local vitest harness | `example-hello-world/` |
