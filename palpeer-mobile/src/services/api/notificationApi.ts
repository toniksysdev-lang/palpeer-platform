import type { SpringPage } from '@/types/api/common';
import type {
  DeviceTokenResponse,
  NotificationResponse,
  RegisterDeviceTokenRequest,
  UnreadCountResponse,
} from '@/types/api/notification';

import { baseApi } from './baseApi';

export const NOTIFICATION_LIST = { type: 'Notification' as const, id: 'LIST' };
export const NOTIFICATION_UNREAD = { type: 'Notification' as const, id: 'UNREAD' };
const PUSH_TOKENS = { type: 'Notification' as const, id: 'DEVICE_TOKENS' };

export const NOTIFICATIONS_PAGE_SIZE = 20;

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.infiniteQuery<SpringPage<NotificationResponse>, void, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ pageParam }) => ({
        path: '/notifications',
        query: { page: pageParam, size: NOTIFICATIONS_PAGE_SIZE },
      }),
      providesTags: [NOTIFICATION_LIST],
    }),
    getNotification: build.query<NotificationResponse, string>({
      query: (id) => ({ path: `/notifications/${encodeURIComponent(id)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Notification', id }],
    }),
    getUnreadCount: build.query<number, void>({
      query: () => ({ path: '/notifications/unread-count' }),
      transformResponse: (response: UnreadCountResponse) => Number(response.count) || 0,
      providesTags: [NOTIFICATION_UNREAD],
    }),
    markNotificationRead: build.mutation<NotificationResponse, string>({
      query: (id) => ({ path: `/notifications/${encodeURIComponent(id)}/read`, method: 'POST' }),
      invalidatesTags: (_result, error, id) =>
        error ? [] : [NOTIFICATION_LIST, NOTIFICATION_UNREAD, { type: 'Notification', id }],
    }),
    getPushTokens: build.query<DeviceTokenResponse[], void>({
      query: () => ({ path: '/notifications/device-tokens' }),
      providesTags: [PUSH_TOKENS],
    }),
    registerPushToken: build.mutation<DeviceTokenResponse, RegisterDeviceTokenRequest>({
      query: (body) => ({ path: '/notifications/device-tokens', method: 'POST', body }),
      invalidatesTags: [PUSH_TOKENS],
    }),
    deletePushToken: build.mutation<void, string>({
      query: (id) => ({
        path: `/notifications/device-tokens/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [PUSH_TOKENS],
    }),
  }),
});

export const {
  useGetNotificationsInfiniteQuery,
  useGetNotificationQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useGetPushTokensQuery,
  useRegisterPushTokenMutation,
  useDeletePushTokenMutation,
} = notificationApi;
