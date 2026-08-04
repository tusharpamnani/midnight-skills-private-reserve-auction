// @ts-check
// signTransactionIntents — workaround for wallet SDK "Failed to clone intent" bug.
// See midnight-js skill docs for details.

import * as ledger from '@midnight-ntwrk/ledger-v8';

export function signTransactionIntents(tx, signFn, proofMarker) {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize(),
    );

    const signature = signFn(cloned.signatureData(segment));

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_, i) => cloned.fallibleUnshieldedOffer.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_, i) => cloned.guaranteedUnshieldedOffer.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}
