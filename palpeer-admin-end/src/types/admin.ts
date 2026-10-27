export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  phone?: string | null;
  status: string;
  enabled: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
};

export type KycCaseSummary = {
  caseId: string;
  userId: string;
  email?: string | null;
  fullName?: string | null;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type P2PRequestSummary = {
  id: string;
  userId: string;
  side: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: number | string;
  rate: number | string;
  status: string;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type P2POrderSummary = {
  id: string;
  requestId: string;
  requesterId: string;
  acceptorId: string;
  amount: number | string;
  rate: number | string;
  status: string;
  createdAt: string;
};

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  userRef?: string | null;
  actorEmail?: string | null;
  action: string;
  entity?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  device?: string | null;
};

/** Admin RBAC operator record from GET/POST /admin/admins. */
export type AdminOperator = {
  id: string;
  userId: string;
  email?: string | null;
  enabled: boolean;
  roleCodes: string[];
};

export type AdminPermission = {
  id: string;
  code: string;
  description?: string | null;
  createdAt?: string | null;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  permissionCodes: string[];
  createdAt?: string | null;
};

export type AdminMe = {
  userId: string;
  email: string;
  enabled: boolean;
  roleCodes: string[];
  permissionCodes: string[];
  mfaEnabled?: boolean;
  mfaEnrollmentRequired?: boolean;
};

export type CurrencySummary = {
  id: string;
  code: string;
  symbol?: string | null;
  precision: number;
};
