// Route for the "OfferLink" artboard (live backend props + optional ?id= / requestId).
import { useLocalSearchParams } from 'expo-router';

import { useLiveOfferLink } from '@/design/bridge/useLiveOfferLink';
import { liveScreen } from '@/design/dc/route';
import OfferLinkScreen from '@/newui/screens/OfferLink';

function useOfferLinkProps() {
  const params = useLocalSearchParams();
  const requestId = String(params.requestId || params.id || '');
  return useLiveOfferLink(requestId || undefined);
}

export default liveScreen(OfferLinkScreen, {}, useOfferLinkProps);
