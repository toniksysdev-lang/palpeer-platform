import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, RefreshControl, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import {
  publicApiErrorMessage,
  toAppError,
} from '@/services/api/errors';
import { useGetPublicP2PRequestQuery } from '@/services/api/currencyApi';
import { pendingNavigation } from '@/services/navigation/pendingNavigation';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';
import { formatMoney } from '@/utils/money';

import { ExpiryCountdown } from '../components/ExpiryCountdown';
import { FlippableRateLine } from '../components/FlippableRateLine';
import { NoSettlementNotice } from '../components/NoSettlementNotice';
import { sideLabel } from '../logic';
import {
  openAppStore,
  sellOrderAcceptPath,
  storeUrlForPlatform,
} from '../shareSellOrder';

/**
 * Guest (and web) view of a shared open sell request.
 * Accept queues the authenticated request screen and sends the user to login.
 * On web / browser without the app, store download CTAs are shown.
 */
export function SharedP2PRequestScreen() {
  const theme = useTheme();
  const now = useNow();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const query = useGetPublicP2PRequestQuery(id ?? '', { skip: !id });
  const onWeb = Platform.OS === 'web';
  const storeUrl = storeUrlForPlatform(onWeb ? 'android' : Platform.OS);
  const iosStore = storeUrlForPlatform('ios');

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    router.replace({ pathname: '/p2p/request/[id]', params: { id } });
  }, [id, isAuthenticated]);

  const header = (
    <StackHeader
      title="Sell order"
      onBack={isAuthenticated ? undefined : () => router.replace('/welcome')}
    />
  );

  if (!id) {
    return (
      <Screen>
        {header}
        <EmptyState title="Link incomplete" message="This share link is missing an order id." />
      </Screen>
    );
  }

  if (query.error && !query.data) {
    const error = toAppError(query.error);
    return (
      <Screen>
        {header}
        <ErrorState
          error={{ ...error, message: publicApiErrorMessage(error) }}
          onRetry={() => void query.refetch()}
        />
        {onWeb ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <AppText tone="secondary" align="center">
              Get PALPEER to browse and accept P2P orders.
            </AppText>
            {storeUrl ? (
              <Button
                label="Download on Google Play"
                onPress={() => void Linking.openURL(storeUrl)}
                testID="p2p-share-play-store"
              />
            ) : null}
            {iosStore ? (
              <Button
                label="Download on the App Store"
                variant="outline"
                onPress={() => void Linking.openURL(iosStore)}
                testID="p2p-share-app-store"
              />
            ) : null}
          </View>
        ) : null}
      </Screen>
    );
  }

  if (!query.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={240} testID="p2p-share-loading" />
      </Screen>
    );
  }

  const data = query.data;
  const base = data.baseCurrencyCode;
  const quote = data.quoteCurrencyCode;
  const amount = formatMoney(data.amount, { currencyCode: base, precision: 2 });
  const expired = data.expiresAt != null && Date.parse(data.expiresAt) <= now;

  const accept = () => {
    pendingNavigation.set(sellOrderAcceptPath(data.id));
    router.push('/login');
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isLoading}
          onRefresh={() => void query.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        onWeb ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" tone="secondary" align="center">
              Install PALPEER to accept this order on your phone.
            </AppText>
            {storeUrl ? (
              <Button
                label="Get it on Google Play"
                onPress={() => void openAppStore('android')}
                testID="p2p-share-play-store"
              />
            ) : null}
            {iosStore ? (
              <Button
                label="Download on the App Store"
                variant="outline"
                onPress={() => void openAppStore('ios')}
                testID="p2p-share-app-store"
              />
            ) : null}
          </View>
        ) : (
          <Button
            label="Accept Order"
            onPress={accept}
            disabled={expired}
            testID="p2p-share-accept"
          />
        )
      }
    >
      {header}
      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Badge label="Sell" tone="info" />
          <Badge label="Open" />
        </View>
        <AppText variant="h2">
          {base}/{quote}
        </AppText>
        <AppText tone="secondary" testID="p2p-share-side">
          {sideLabel(data.side, base, quote, 'other')}
        </AppText>
      </View>

      {expired ? (
        <FormAlert
          tone="warning"
          message="This sell order has expired and can no longer be accepted."
          testID="p2p-share-expired"
        />
      ) : (
        <FormAlert
          tone="info"
          message="Sign in to accept this order and complete the P2P exchange."
          testID="p2p-share-guest-hint"
        />
      )}

      <Card variant="outlined" padding="md">
        <ReviewRow label="Amount" value={amount} testID="p2p-share-amount" />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <AppText tone="secondary" style={{ flex: 1 }}>
            Rate
          </AppText>
          <View style={{ flex: 2, alignItems: 'flex-end' }}>
            <FlippableRateLine
              rate={data.rate}
              base={base}
              quote={quote}
              variant="bodyStrong"
              tone="primary"
              align="right"
              testID="p2p-share-rate"
            />
          </View>
        </View>
        <ReviewRow
          label="Expires"
          value={formatDateTime(data.expiresAt) ?? 'No expiry'}
          testID="p2p-share-expires"
        />
        {data.expiresAt && !expired ? (
          <ExpiryCountdown expiresAt={data.expiresAt} testID="p2p-share-countdown" />
        ) : null}
        <ReviewRow label="Posted" value={formatDateTime(data.createdAt) ?? '—'} />
        <ReviewRow
          label="Posted by"
          value={data.posterDisplayName?.trim() || 'Palpeer user'}
          testID="p2p-share-poster"
        />
      </Card>

      <NoSettlementNotice />
    </Screen>
  );
}
