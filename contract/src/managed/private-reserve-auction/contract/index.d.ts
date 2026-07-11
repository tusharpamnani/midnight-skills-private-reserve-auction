import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum AuctionState { OPEN = 0, CLOSED = 1, SETTLED = 2 }

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  bid(context: __compactRuntime.CircuitContext<PS>,
      bidAmount_0: bigint,
      _address_0: { bytes: Uint8Array },
      _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeAuction(context: __compactRuntime.CircuitContext<PS>,
               _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrice(context: __compactRuntime.CircuitContext<PS>,
              minPrice_0: bigint,
              _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimItem(context: __compactRuntime.CircuitContext<PS>,
            _address_0: { bytes: Uint8Array },
            _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimProceeds(context: __compactRuntime.CircuitContext<PS>,
                _address_0: { bytes: Uint8Array },
                _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  bid(context: __compactRuntime.CircuitContext<PS>,
      bidAmount_0: bigint,
      _address_0: { bytes: Uint8Array },
      _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeAuction(context: __compactRuntime.CircuitContext<PS>,
               _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrice(context: __compactRuntime.CircuitContext<PS>,
              minPrice_0: bigint,
              _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimItem(context: __compactRuntime.CircuitContext<PS>,
            _address_0: { bytes: Uint8Array },
            _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimProceeds(context: __compactRuntime.CircuitContext<PS>,
                _address_0: { bytes: Uint8Array },
                _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  bid(context: __compactRuntime.CircuitContext<PS>,
      bidAmount_0: bigint,
      _address_0: { bytes: Uint8Array },
      _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeAuction(context: __compactRuntime.CircuitContext<PS>,
               _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrice(context: __compactRuntime.CircuitContext<PS>,
              minPrice_0: bigint,
              _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimItem(context: __compactRuntime.CircuitContext<PS>,
            _address_0: { bytes: Uint8Array },
            _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimProceeds(context: __compactRuntime.CircuitContext<PS>,
                _address_0: { bytes: Uint8Array },
                _secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly organizer: Uint8Array;
  readonly hiddenPrice: Uint8Array;
  readonly maxBids: bigint;
  readonly publicPrice: bigint;
  readonly auctionState: AuctionState;
  bidders: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly bidCount: bigint;
  readonly highestBid: bigint;
  winnerClaimed: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: { bytes: Uint8Array }): boolean;
    [Symbol.iterator](): Iterator<{ bytes: Uint8Array }>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               minPrice_0: bigint,
               maxBidCount_0: bigint,
               _secret_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
