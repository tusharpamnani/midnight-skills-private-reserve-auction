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

export type PartyStateName = (typeof PARTY_STATE_NAMES)[number];

let _compiledContract: any = null;
async function makeCompiledContract() {
  if (!_compiledContract) {
    _compiledContract = await getCompiledContract(ZK_PATH);
  }
  return _compiledContract;
}

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
  const cc = await makeCompiledContract();
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
  const cc = await makeCompiledContract();
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
  const cc = await makeCompiledContract();
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
  const cc = await makeCompiledContract();
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
  const cc = await makeCompiledContract();
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
  const cc = await makeCompiledContract();
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
    partyState: (PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as PartyStateName | string,
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
