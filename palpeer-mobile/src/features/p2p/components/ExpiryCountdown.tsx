import { AppText } from '@/components/ui/AppText';

import { useExpiryCountdown } from '../useExpiryCountdown';

/** Live expiry countdown for an OPEN P2P request (or any row with `expiresAt`). */
export function ExpiryCountdown({
  expiresAt,
  active = true,
  testID,
}: {
  expiresAt: string | null | undefined;
  active?: boolean;
  testID?: string;
}) {
  const { label, expired } = useExpiryCountdown(expiresAt, active);
  if (!label) return null;
  return (
    <AppText variant="caption" tone={expired ? 'danger' : 'secondary'} testID={testID}>
      {expired ? 'Expired' : `Expires in ${label}`}
    </AppText>
  );
}
