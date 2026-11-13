import { useLocalSearchParams } from 'expo-router';

import { useLiveTransactionDetail } from '@/design/bridge/useLiveTransactionDetail';
import { liveScreen } from '@/design/dc/route';
import TransactionDetailScreen from '@/newui/screens/TransactionDetail';

function useTransactionDetailProps() {
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  return useLiveTransactionDetail(String(params.type || ''), String(params.id || ''));
}

/** Messages → See details (and deep links) — newui receipt, live backend. */
export default liveScreen(TransactionDetailScreen, {}, useTransactionDetailProps);
