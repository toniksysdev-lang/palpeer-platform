import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `NotificationStatus`. Unread = `PENDING` + `SENT` (backend unread-count). */
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ';

/** VERIFIED: `NotificationChannel`. */
export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'BOTH';

/** VERIFIED: `NotificationResponse`. `category` and `referenceType` are free text (`REFERRAL` today). */
export type NotificationResponse = {
  id: Uuid;
  title: string;
  body: string;
  category: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  referenceType: string | null;
  referenceId: Uuid | null;
  readAt: IsoInstant | null;
  sentAt: IsoInstant | null;
  failureReason: string | null;
  createdAt: IsoInstant;
};

export type UnreadCountResponse = { count: number };

/** VERIFIED: `DeviceTokenPlatform`. */
export type DeviceTokenPlatform = 'IOS' | 'ANDROID' | 'WEB' | 'OTHER';

/** VERIFIED: `RegisterDeviceTokenRequest`. Upserted by `token`. */
export type RegisterDeviceTokenRequest = {
  /** ≤ 512 characters. */
  token: string;
  platform: DeviceTokenPlatform;
  /** ≤ 255 characters. */
  deviceIdentifier?: string;
};

/** VERIFIED: `DeviceTokenResponse` (the push token itself is not returned). */
export type DeviceTokenResponse = {
  id: Uuid;
  platform: DeviceTokenPlatform;
  deviceIdentifier: string | null;
  enabled: boolean;
  lastSeenAt: IsoInstant;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
};
