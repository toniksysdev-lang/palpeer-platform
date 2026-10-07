import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/data-display/StatusBadge';

describe('StatusBadge', () => {
  it('renders humanized status labels', () => {
    render(<StatusBadge status="UNDER_REVIEW" />);
    expect(screen.getByText('Under Review')).toBeInTheDocument();
  });

  it('renders success statuses', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
