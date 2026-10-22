export type NotificationSummary = {
  id: string;
  title: string;
  body?: string | null;
  category?: string | null;
  channel: string;
  status: string;
  referenceType?: string | null;
  referenceId?: string | null;
  readAt?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
};

export type BroadcastPushInput = {
  title: string;
  body: string;
  category?: string;
};

export type BroadcastPushResult = {
  recipientCount: number;
  title: string;
  devicePushCount: number;
  failedCount: number;
  fcmEnabled: boolean;
};
