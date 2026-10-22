import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('confirms and cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Disable user"
        description="This will disable the account."
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        description="Nope"
        onConfirm={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('disables confirm when confirmDisabled is set', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete"
        description="Needs extra confirmation."
        confirmLabel="Delete forever"
        confirmDisabled
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
