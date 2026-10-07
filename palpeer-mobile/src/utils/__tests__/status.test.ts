import { humanizeStatus, toneForStatus } from '../status';

describe('status helpers', () => {
  it('maps backend enum values to tones', () => {
    expect(toneForStatus('SUCCESS')).toBe('success');
    expect(toneForStatus('COMPLETED')).toBe('success');
    expect(toneForStatus('PROCESSING')).toBe('warning');
    expect(toneForStatus('UNDER_REVIEW')).toBe('warning');
    expect(toneForStatus('OPEN')).toBe('info');
    expect(toneForStatus('FAILED')).toBe('danger');
    expect(toneForStatus('BLOCKED')).toBe('danger');
    expect(toneForStatus('REVERSED')).toBe('neutral');
    expect(toneForStatus('EXPIRED')).toBe('neutral');
  });

  it('falls back to neutral for unknown or missing values', () => {
    expect(toneForStatus('SOMETHING_NEW')).toBe('neutral');
    expect(toneForStatus(undefined)).toBe('neutral');
    expect(toneForStatus('success')).toBe('success');
  });

  it('humanizes enum names', () => {
    expect(humanizeStatus('UNDER_REVIEW')).toBe('Under review');
    expect(humanizeStatus('PENDING_VERIFICATION')).toBe('Pending verification');
    expect(humanizeStatus('SUCCESS')).toBe('Success');
    expect(humanizeStatus('')).toBe('Unknown');
    expect(humanizeStatus(null)).toBe('Unknown');
  });
});
