import type { AuditLogEntry, SpringPage } from '@/types/admin';

const now = Date.now();

export const mockAuditCatalog: AuditLogEntry[] = [
  {
    id: 'a-1',
    createdAt: new Date(now - 3600_000).toISOString(),
    userRef: 'admin@palpeer.local',
    actorEmail: 'admin@palpeer.local',
    action: 'USER_UPDATE',
    entity: 'User',
    oldValue: 'status=ACTIVE;enabled=true',
    newValue: 'status=SUSPENDED;enabled=false',
    ipAddress: '203.0.113.10',
    device: 'Chrome/Windows',
  },
  {
    id: 'a-2',
    createdAt: new Date(now - 7200_000).toISOString(),
    userRef: 'admin@palpeer.local',
    actorEmail: 'admin@palpeer.local',
    action: 'KYC_REVIEW',
    entity: 'KycCase',
    oldValue: 'status=PENDING',
    newValue: 'status=APPROVED',
    ipAddress: '203.0.113.10',
    device: 'Chrome/Windows',
  },
  {
    id: 'a-3',
    createdAt: new Date(now - 10_800_000).toISOString(),
    userRef: 'ops@palpeer.local',
    actorEmail: 'ops@palpeer.local',
    action: 'RATE_PUBLISH',
    entity: 'ExchangeRate',
    oldValue: null,
    newValue: 'USD/NGN=1600.25',
    ipAddress: '198.51.100.22',
    device: 'Firefox/macOS',
  },
  {
    id: 'a-4',
    createdAt: new Date(now - 86_400_000).toISOString(),
    userRef: 'ops@palpeer.local',
    actorEmail: 'ops@palpeer.local',
    action: 'ADMIN_ASSIGN',
    entity: 'AdminUser',
    oldValue: 'enabled=false;roles=',
    newValue: 'enabled=true;roles=SUPER_ADMIN',
    ipAddress: '198.51.100.22',
    device: 'Firefox/macOS',
  },
  {
    id: 'a-5',
    createdAt: new Date(now - 172_800_000).toISOString(),
    userRef: 'compliance@palpeer.local',
    actorEmail: 'compliance@palpeer.local',
    action: 'P2P_STATUS',
    entity: 'P2POrder',
    oldValue: 'status=OPEN',
    newValue: 'status=CANCELLED',
    ipAddress: '192.0.2.55',
    device: 'Safari/iOS',
  },
];

export function mockSearchAuditLogs(params: {
  userRef?: string;
  action?: string;
  entity?: string;
  page?: number;
  size?: number;
}): SpringPage<AuditLogEntry> {
  const page = params.page ?? 0;
  const size = params.size ?? 50;
  let filtered = [...mockAuditCatalog];

  if (params.userRef) {
    const q = params.userRef.toLowerCase();
    filtered = filtered.filter((row) => row.userRef?.toLowerCase().includes(q));
  }
  if (params.action) {
    const q = params.action.toLowerCase();
    filtered = filtered.filter((row) => row.action.toLowerCase().includes(q));
  }
  if (params.entity) {
    const q = params.entity.toLowerCase();
    filtered = filtered.filter((row) => row.entity?.toLowerCase().includes(q));
  }

  const start = page * size;
  const content = filtered.slice(start, start + size);
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}