import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input form control', () => {
  it('associates label and captures typing', async () => {
    const user = userEvent.setup();
    render(<Input label="Email" name="email" defaultValue="" />);
    const field = screen.getByLabelText('Email');
    await user.type(field, 'ops@palpeer.local');
    expect(field).toHaveValue('ops@palpeer.local');
  });

  it('shows validation error text', () => {
    render(<Input label="Password" name="password" error="Password is required." />);
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });
});
