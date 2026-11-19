import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useLiveOfferLink } from '@/design/bridge/useLiveOfferLink';
import OfferLinkScreen from '@/newui/screens/OfferLink';
import { Loading, Screen } from '@/newui/ui/kit';
import { useAppSelector } from '@/store';

/**
 * Guest share landing (`/p2p-share/:id` from https://…/p2p/share/:id).
 * Signed-in users go straight to the newui People offer for that request.
 */
export default function P2PShareScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const requestId = (Array.isArray(id) ? id[0] : id)?.trim() || '';
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const props = useLiveOfferLink(requestId || undefined);

  useEffect(() => {
    if (!authenticated || !requestId) return;
    router.replace(`/PeopleOffer?requestId=${encodeURIComponent(requestId)}`);
  }, [authenticated, requestId]);

  if (authenticated && requestId) {
    return (
      <Screen>
        <Loading title="Opening offer" text="Just a moment." />
      </Screen>
    );
  }

  return <OfferLinkScreen {...props} />;
}
