import { router, useLocalSearchParams } from 'expo-router';
import { ClipboardList, Handshake, MessagesSquare } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { NegotiationCard } from '@/features/negotiation/components/NegotiationCard';
import { useNegotiationRealtime } from '@/features/negotiation/useNegotiationRealtime';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetMyNegotiationsQuery } from '@/services/api/negotiationApi';
import { useGetMyOrdersQuery, useGetMyRequestsQuery } from '@/services/api/p2pApi';
import { useAppSelector } from '@/store';

import { OrderCard } from '../components/OrderCard';
import { RequestCard } from '../components/RequestCard';

type Tab = 'requests' | 'offers' | 'orders';

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'requests', label: 'My requests' },
  { value: 'offers', label: 'Offers' },
  { value: 'orders', label: 'Orders' },
];

function initialTab(param: string | undefined): Tab {
  return param === 'orders' || param === 'offers' ? param : 'requests';
}

function Loading() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }} testID="p2p-history-loading">
      <Skeleton height={120} />
      <Skeleton height={120} />
    </View>
  );
}

/** My requests in every status, negotiations I'm part of, and orders on either side. */
export function P2PHistoryScreen() {
  const theme = useTheme();
  const now = useNow();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(initialTab(params.tab));
  const userId = useAppSelector((state) => state.session.userId);
  const requests = useGetMyRequestsQuery();
  const negotiations = useGetMyNegotiationsQuery();
  useNegotiationRealtime();
  const orders = useGetMyOrdersQuery();
  const active = tab === 'requests' ? requests : tab === 'offers' ? negotiations : orders;

  let body;
  if (active.error && !active.data) {
    body = <ErrorState error={toAppError(active.error)} onRetry={() => void active.refetch()} />;
  } else if (tab === 'requests') {
    if (!requests.data) body = <Loading />;
    else if (requests.data.length === 0)
      body = (
        <EmptyState
          icon={ClipboardList}
          title="No requests yet"
          message="Requests you post appear here with their status."
          actionLabel="Create request"
          onAction={() => router.push('/p2p/create')}
        />
      );
    else
      body = requests.data.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          own
          now={now}
          showStatus
          onPress={() => router.push({ pathname: '/p2p/request/[id]', params: { id: request.id } })}
        />
      ));
  } else if (tab === 'offers') {
    if (!negotiations.data) body = <Loading />;
    else if (negotiations.data.length === 0)
      body = (
        <EmptyState
          icon={MessagesSquare}
          title="No offers yet"
          message="Offers you make on requests, and offers others make on yours, appear here."
        />
      );
    else
      body = negotiations.data.map((negotiation) => (
        <NegotiationCard
          key={negotiation.id}
          negotiation={negotiation}
          userId={userId}
          onPress={() =>
            router.push({ pathname: '/negotiation/[id]', params: { id: negotiation.id } })
          }
        />
      ));
  } else if (!orders.data) {
    body = <Loading />;
  } else if (orders.data.length === 0) {
    body = (
      <EmptyState
        icon={Handshake}
        title="No orders yet"
        message="When you accept a request or an offer, or someone accepts yours, the order appears here."
      />
    );
  } else {
    body = orders.data.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
        userId={userId}
        onPress={() => router.push({ pathname: '/p2p/order/[id]', params: { id: order.id } })}
      />
    ));
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={active.isFetching && !active.isLoading}
          onRefresh={() => void active.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title="P2P history" />
      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Requests, offers or orders"
      />
      {active.error && active.data ? (
        <FormAlert tone="warning" message="Couldn't refresh. Pull down to try again." />
      ) : null}
      <View style={{ gap: theme.spacing.md }}>{body}</View>
    </Screen>
  );
}
