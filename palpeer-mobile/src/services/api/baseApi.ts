import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react';

import { authorizedRequest } from './authorized';
import { apiRequest, type RequestOptions } from './client';
import type { AppError } from './errors';

export type ApiArgs = Omit<RequestOptions, 'accessToken' | 'signal'> & {
  path: string;
  /** Public endpoints (login, register, OTP) skip the bearer token and the refresh flow. */
  public?: boolean;
};

const baseQuery: BaseQueryFn<ApiArgs, unknown, AppError> = async (args, api) => {
  const { path, public: isPublic, ...options } = args;
  const result = isPublic
    ? await apiRequest<unknown>(path, { ...options, signal: api.signal })
    : await authorizedRequest<unknown>(path, { ...options, signal: api.signal });
  return result.ok ? { data: result.data ?? null } : { error: result.error };
};

export const TAG_TYPES = [
  'Session',
  'Profile',
  'KycStatus',
  'Security',
  'Wallet',
  'Transaction',
  'Currency',
  'Rate',
  'P2PRequest',
  'P2POrder',
  'Negotiation',
  'ChatRoom',
  'ChatMessage',
  'Card',
  'Notification',
  'Promotion',
  'MarketingAdvert',
  'Referral',
  'Bonus',
] as const;

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: TAG_TYPES,
  refetchOnReconnect: true,
  refetchOnFocus: true,
  endpoints: () => ({}),
});
