import { apiRequest } from '@/services/api/client';
import type { AuditLogEntry, SpringPage } from '@/types/admin';

export type AuditSearchParams = {
  userRef?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export async function searchAuditLogs(
  params: AuditSearchParams = {},
): Promise<SpringPage<AuditLogEntry>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 50),
  });
  if (params.userRef) search.set('userRef', params.userRef);
  if (params.action) search.set('action', params.action);
  if (params.entity) search.set('entity', params.entity);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.sort) search.set('sort', params.sort);

  return apiRequest<SpringPage<AuditLogEntry>>(`/admin/audit-logs?${search.toString()}`);
}
