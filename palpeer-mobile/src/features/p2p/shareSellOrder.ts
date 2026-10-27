import { Linking, Platform, Share } from 'react-native';

import { appConfig } from '@/config/env';
import type { P2PRequestResponse } from '@/types/api/p2p';

import { preferredRateUnit, p2pRateLine } from './logic';

/** In-app (and App Link) path for a shared open sell request. */
export function sellOrderSharePath(requestId: string): string {
  return `/p2p/share/${requestId}`;
}

/** Destination after login from guest Accept. */
export function sellOrderAcceptPath(requestId: string): string {
  return `/p2p/request/${requestId}`;
}

/**
 * HTTPS share link for messages. Uses the API host bridge (`GET /p2p/share/{id}`) so the
 * installed app opens via {@code palpeer://}, not the marketing website.
 */
export function sellOrderShareUrl(requestId: string): string {
  const apiRoot = appConfig.apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(apiRoot)) {
    // API host serves an HTML bridge that opens palpeer:// — not the marketing website.
    return `${apiRoot}${sellOrderSharePath(requestId)}`;
  }
  return `palpeer:/${sellOrderSharePath(requestId)}`;
}

export function sellOrderShareMessage(
  request: Pick<
    P2PRequestResponse,
    'id' | 'amount' | 'rate' | 'baseCurrencyCode' | 'quoteCurrencyCode'
  >,
  formattedAmount: string,
): string {
  const { baseCurrencyCode: base, quoteCurrencyCode: quote } = request;
  const rate = p2pRateLine(request.rate, base, quote, preferredRateUnit(base, quote));
  const url = sellOrderShareUrl(request.id);
  return `I'm selling ${formattedAmount} on PALPEER at ${rate}. Accept my order: ${url}`;
}

export async function shareSellOrder(
  request: Pick<
    P2PRequestResponse,
    'id' | 'amount' | 'rate' | 'baseCurrencyCode' | 'quoteCurrencyCode' | 'side' | 'status'
  >,
  formattedAmount: string,
): Promise<'shared' | 'cancelled'> {
  const message = sellOrderShareMessage(request, formattedAmount);
  const result = await Share.share(
    Platform.OS === 'ios'
      ? { message }
      : { message, title: 'Share Your Sell Order' },
  );
  if (result.action === Share.sharedAction) return 'shared';
  return 'cancelled';
}

/** Play Store / App Store when the share page is opened outside the native app. */
export function storeUrlForPlatform(platform: string = Platform.OS): string | null {
  if (platform === 'ios') return appConfig.share.iosStoreUrl;
  if (platform === 'android' || platform === 'web') return appConfig.share.androidStoreUrl;
  return appConfig.share.androidStoreUrl;
}

export async function openAppStore(platform: string = Platform.OS): Promise<void> {
  const url = storeUrlForPlatform(platform);
  if (!url) return;
  await Linking.openURL(url);
}

export function canShareSellOrder(
  request: Pick<P2PRequestResponse, 'side' | 'status'>,
  own: boolean,
  nowStatus: string | null,
): boolean {
  return own && request.side === 'SELL' && (nowStatus ?? request.status) === 'OPEN';
}
