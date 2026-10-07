export const P2P_STATUSES = [
  'OPEN',
  'ACCEPTED',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type P2PStatus = (typeof P2P_STATUSES)[number];

/** Verified admin override targets (P15-05). */
export const P2P_ADMIN_STATUSES = ['CANCELLED', 'COMPLETED'] as const;
export type P2PAdminStatus = (typeof P2P_ADMIN_STATUSES)[number];

export type UpdateP2PStatusInput = {
  status: P2PAdminStatus;
};
