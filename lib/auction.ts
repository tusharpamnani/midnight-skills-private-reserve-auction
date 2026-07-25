import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { getCompiledContract, getLedger, sampleSigningKey, ContractState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { fromHex, pollForState } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivateAuctionState';
export const ZK_PATH = '/zk/private-reserve-auction';

const AUCTION_STATE_NAMES = ['OPEN', 'CLOSED', 'SETTLED'] as const;

export type AuctionStateName = (typeof AUCTION_STATE_NAMES)[number];

let _compiledContract: any = null;
async function makeCompiledContract() {
  if (!_compiledContract) {
    _compiledContract = await getCompiledContract(ZK_PATH);
  }
  return _compiledContract;
}

export async function initPrivateState(
  session: ConnectedSession,
  contractAddress: string,
) {
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {});
}

function setSize(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => bigint)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

function setToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => number)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

export async function deployAuction(
  session: ConnectedSession,
  reservePriceNight: number,
  maxBidders: number,
  sellerSecret: Uint8Array,
): Promise<string> {
  const reservePriceStars = reservePriceNight * 1_000_000;
  const cc = await makeCompiledContract();
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: cc,
      args: [BigInt(reservePriceStars), BigInt(maxBidders), sellerSecret],
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

async function call(
  session: ConnectedSession,
  contractAddress: string,
  circuitId: string,
  args: unknown[],
) {
  const cc = await makeCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId,
    args,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export const placeBid = (session: ConnectedSession, contractAddress: string, bidAmountNight: number, userAddress: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  call(session, contractAddress, 'bid', [BigInt(bidAmountNight * 1_000_000), userAddress, bidderSecret]);

export const closeAuction = (session: ConnectedSession, contractAddress: string, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'closeAuction', [sellerSecret]);

export const revealPrice = (session: ConnectedSession, contractAddress: string, reservePriceNight: number, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'revealPrice', [BigInt(reservePriceNight * 1_000_000), sellerSecret]);

export const claimItem = (session: ConnectedSession, contractAddress: string, userAddress: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  call(session, contractAddress, 'claimItem', [userAddress, bidderSecret]);

export const claimProceeds = (session: ConnectedSession, contractAddress: string, sellerAddress: { bytes: Uint8Array }, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'claimProceeds', [sellerAddress, sellerSecret]);

export async function decodeAuctionState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = await getLedger();
  const l = ledger(contractState.data) as any;
  const stateIdx = Number(l.auctionState);
  return {
    auctionState: (AUCTION_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as AuctionStateName | string,
    auctionStateIndex: stateIdx,
    maxBidders: Number(l.maxBids),
    publicPriceNight: Number(l.publicPrice) / 1_000_000,
    highestBidNight: Number(l.highestBid) / 1_000_000,
    bidCount: setToNumber(l.bidCount),
    bidderCount: setSize(l.bidders),
  };
}

export async function fetchAuctionState(queryUrl: string, contractAddress: string) {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodeAuctionState(hex);
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.config.networkId);
}
