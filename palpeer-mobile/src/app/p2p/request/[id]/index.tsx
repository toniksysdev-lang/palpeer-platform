import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy `/p2p/request/:id` → newui People offer (Accept and buy / Offer a different price).
 * Share links and older deep links still resolve here, then land on PeopleOffer.
 */
export default function P2PRequestRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  if (!requestId?.trim()) {
    return <Redirect href="/People" />;
  }
  return <Redirect href={`/PeopleOffer?requestId=${encodeURIComponent(requestId.trim())}`} />;
}
