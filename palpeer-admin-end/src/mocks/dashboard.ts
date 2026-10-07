import type {
  AdminUserSummary,
  AuditLogEntry,
  CurrencySummary,
  KycCaseSummary,
  P2POrderSummary,
  P2PRequestSummary,
  SpringPage,
} from '@/types/admin';

function pageOf<T>(content: T[], totalElements = content.length): SpringPage<T> {
  return {
    content,
    totalElements,
    totalPages: 1,
    size: content.length || 20,
    number: 0,
    numberOfElements: content.length,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

const now = Date.now();

export const mockUsersPage: SpringPage<AdminUserSummary> = pageOf(
  [
    {
      id: 'u-1',
      email: 'operator@palpeer.local',
      phone: '+10000000001',
      status: 'ACTIVE',
      enabled: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date(now - 86400000 * 12).toISOString(),
    },
    {
      id: 'u-2',
      email: 'member@palpeer.local',
      phone: null,
      status: 'PENDING_VERIFICATION',
      enabled: true,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
  ],
  128,
);

export const mockKycPage: SpringPage<KycCaseSummary> = pageOf(
  [
    {
      caseId: 'kyc-1',
      userId: 'u-2',
      status: 'UNDER_REVIEW',
      rejectionReason: null,
    },
    {
      caseId: 'kyc-2',
      userId: 'u-3',
      status: 'APPROVED',
      rejectionReason: null,
    },
  ],
  17,
);

export const mockP2PRequests: P2PRequestSummary[] = [
  {
    id: 'req-1',
    userId: 'u-2',
    side: 'BUY',
    baseCurrencyCode: 'NGN',
    quoteCurrencyCode: 'CAD',
    amount: '150000',
    rate: '1050.25',
    status: 'OPEN',
    createdAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: 'req-2',
    userId: 'u-4',
    side: 'SELL',
    baseCurrencyCode: 'CAD',
    quoteCurrencyCode: 'NGN',
    amount: '500',
    rate: '1048.00',
    status: 'OPEN',
    createdAt: new Date(now - 7200000).toISOString(),
  },
];

export const mockP2POrders: P2POrderSummary[] = [
  {
    id: 'ord-1',
    requestId: 'req-0',
    requesterId: 'u-2',
    acceptorId: 'u-5',
    amount: '250',
    rate: '1049.5',
    status: 'COMPLETED',
    createdAt: new Date(now - 86400000).toISOString(),
  },
];

export const mockAuditPage: SpringPage<AuditLogEntry> = pageOf([
  {
    id: 'a-1',
    createdAt: new Date(now - 600000).toISOString(),
    userRef: 'operator@palpeer.local',
    action: 'ADMIN_LOGIN',
    entity: 'AdminSession',
    newValue: 'success',
  },
  {
    id: 'a-2',
    createdAt: new Date(now - 1200000).toISOString(),
    userRef: 'operator@palpeer.local',
    action: 'RATE_PUBLISHED',
    entity: 'ExchangeRate',
    newValue: 'CAD/NGN',
  },
]);

export const mockCurrencies: CurrencySummary[] = [
  { id: 'c-1', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-2', code: 'NGN', symbol: '₦', precision: 2 },
  { id: 'c-3', code: 'USD', symbol: '$', precision: 2 },
];
