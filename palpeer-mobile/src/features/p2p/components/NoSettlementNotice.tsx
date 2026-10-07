import { FormAlert } from '@/components/feedback/FormAlert';

/** P2P has no escrow, hold or settlement (R-P-5, P-2); balances never change because of it. */
export function NoSettlementNotice() {
  return (
    <FormAlert
      tone="info"
      message="Palpeer doesn't hold or move money for P2P orders yet, so your wallet balances won't change."
      testID="p2p-no-settlement"
    />
  );
}
