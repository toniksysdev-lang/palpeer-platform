import { Badge } from '@/components/ui/Badge';
import { formatStatusLabel } from '@/lib/format';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

function toneForStatus(status: string): Tone {
  const normalized = status.toUpperCase();
  if (['APPROVED', 'ACTIVE', 'COMPLETED', 'ENABLED', 'OPEN'].includes(normalized)) return 'success';
  if (
    [
      'UNDER_REVIEW',
      'SUBMITTED',
      'PENDING_VERIFICATION',
      'PROCESSING',
      'IN_PROGRESS',
      'NOT_STARTED',
      'ACCEPTED',
      'PENDING',
    ].includes(normalized)
  ) {
    return 'warning';
  }
  if (
    [
      'REJECTED',
      'CANCELLED',
      'FAILED',
      'SUSPENDED',
      'CLOSED',
      'DISABLED',
      'EXPIRED',
      'BLOCKED',
    ].includes(normalized)
  ) {
    return 'danger';
  }
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={toneForStatus(status)}>{formatStatusLabel(status)}</Badge>;
}
