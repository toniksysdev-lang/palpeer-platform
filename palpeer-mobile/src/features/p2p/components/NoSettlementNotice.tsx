import { FormAlert } from '@/components/feedback/FormAlert';

/** Sell listings hold base until accept settles (or cancel/expire returns it). */
export function NoSettlementNotice() {
  return (
    <FormAlert
      tone="info"
      message="Sell requests temporarily hold the base amount from your wallet. On accept, wallets settle automatically: base moves to the buyer and quote moves to the seller. The hold is returned if the request expires or is cancelled."
      testID="p2p-no-settlement"
    />
  );
}
