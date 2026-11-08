import type {
  BusinessInterest,
  DeleteBusinessInterestsResult,
  SendBusinessInterestEmailInput,
  SendBusinessInterestEmailResult,
} from '@/types/businessWaitlist';

const now = new Date().toISOString();

let interests: BusinessInterest[] = [
  {
    id: 'biz-wait-1',
    email: 'founder@example.com',
    source: 'mobile',
    createdAt: now,
  },
  {
    id: 'biz-wait-2',
    email: 'ops@acme.co',
    source: 'mobile',
    createdAt: now,
  },
];

export function mockListBusinessInterests(): BusinessInterest[] {
  return [...interests];
}

export function mockSendBusinessInterestEmail(
  input: SendBusinessInterestEmailInput,
): SendBusinessInterestEmailResult {
  const targets = input.all
    ? interests
    : interests.filter((row) => (input.ids ?? []).includes(row.id));
  return { sentCount: targets.length, failedCount: 0 };
}

export function mockDeleteBusinessInterest(id: string): void {
  interests = interests.filter((row) => row.id !== id);
}

export function mockDeleteBusinessInterests(ids: string[]): DeleteBusinessInterestsResult {
  const remove = new Set(ids);
  const before = interests.length;
  interests = interests.filter((row) => !remove.has(row.id));
  return { deletedCount: before - interests.length };
}
