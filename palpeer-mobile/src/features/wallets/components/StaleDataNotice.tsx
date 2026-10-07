import { FormAlert } from '@/components/feedback/FormAlert';
import { formatClockTime } from '@/utils/datetime';

/**
 * Shown when a refresh failed but older data is still on screen, so a cached balance is never
 * presented as current.
 */
export function StaleDataNotice({
  error,
  fulfilledTimeStamp,
  testID,
}: {
  error: unknown;
  fulfilledTimeStamp: number | undefined;
  testID?: string;
}) {
  if (!error || !fulfilledTimeStamp) return null;
  const time = formatClockTime(new Date(fulfilledTimeStamp).toISOString());
  return (
    <FormAlert
      tone="warning"
      message={`Couldn't refresh. Showing balances from ${time}.`}
      testID={testID}
    />
  );
}
