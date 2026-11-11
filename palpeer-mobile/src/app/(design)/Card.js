// Route for Card detail + history — newui presentation, live backend props.
import { useLocalSearchParams } from 'expo-router';

import { useLiveCard } from '@/design/bridge/useLiveCard';
import { liveScreen } from '@/design/dc/route';
import CardScreen from '@/newui/screens/Card';

function useCardProps() {
  const params = useLocalSearchParams();
  const id = String(params.id || '');
  return useLiveCard(id);
}

export default liveScreen(CardScreen, {}, useCardProps);
