// Route for the design Card artboard (detail + history, live backend props).
import { useLocalSearchParams } from 'expo-router';

import CardScreen from '@/design/screens/Card';
import { useLiveCard } from '@/design/bridge/useLiveCard';
import { screen } from '@/design/dc/route';

function useCardProps() {
  const params = useLocalSearchParams();
  const id = String(params.id || '');
  return useLiveCard(id);
}

export default screen(CardScreen, {}, useCardProps);
