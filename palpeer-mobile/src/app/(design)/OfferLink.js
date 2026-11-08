// Route for the "OfferLink" artboard (live backend props + optional ?id= / requestId).
import { useLocalSearchParams } from 'expo-router';

import OfferLinkScreen from '@/design/screens/OfferLink';
import { useLiveOfferLink } from '@/design/bridge/useLiveOfferLink';
import { screen } from '@/design/dc/route';

function useOfferLinkProps() {
  const params = useLocalSearchParams();
  const requestId = String(params.requestId || params.id || '');
  return useLiveOfferLink(requestId || undefined);
}

export default screen(OfferLinkScreen, {}, useOfferLinkProps);
