import { apiBinaryRequest, apiRequest, type BinaryResponse } from '@/services/api/client';
import type { AdminReportsSummary, ReportDataset, ReportWindow } from '@/types/reports';

function windowQuery(window: ReportWindow): string {
  const search = new URLSearchParams();
  if (window.from) search.set('from', window.from);
  if (window.to) search.set('to', window.to);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getReportsSummary(window: ReportWindow = {}): Promise<AdminReportsSummary> {
  return apiRequest<AdminReportsSummary>(`/admin/reports/summary${windowQuery(window)}`);
}

export async function exportReportDataset(
  dataset: ReportDataset,
  window: ReportWindow = {},
): Promise<BinaryResponse> {
  return apiBinaryRequest(
    `/admin/reports/export/${encodeURIComponent(dataset)}${windowQuery(window)}`,
    { accept: 'text/csv' },
  );
}
