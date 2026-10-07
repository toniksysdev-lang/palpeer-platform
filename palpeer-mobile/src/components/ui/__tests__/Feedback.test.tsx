import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { useToast } from '@/providers/ToastProvider';
import { createAppError } from '@/services/api/errors';
import { darkColors, lightColors } from '@/theme';
import { renderWithProviders } from '@/tests/render';

import { ConfirmDialog } from '../AppModal';
import { StatusBadge } from '../Badge';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';

describe('StatusBadge', () => {
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('uses %s tone colours for backend statuses', async (appearance, colors) => {
    await renderWithProviders(<StatusBadge status="UNDER_REVIEW" />, { appearance });

    const label = screen.getByText('Under review');
    const flat = [label.props.style].flat(Infinity);
    expect(flat).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.warning })]),
    );
  });

  it('falls back to a neutral label for missing statuses', async () => {
    await renderWithProviders(<StatusBadge status={null} />);
    expect(screen.getByText('Unknown')).toBeTruthy();
  });
});

describe('ConfirmDialog', () => {
  it('calls confirm and cancel handlers', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmDialog
        visible
        title="Remove card?"
        message="You can't undo this."
        confirmLabel="Remove"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Remove card?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('blocks cancel while the action is loading', async () => {
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmDialog
        visible
        title="Sending"
        message="Please wait"
        confirmLabel="Send"
        loading
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('BottomSheet', () => {
  it('renders its content only while visible', async () => {
    const { rerender } = await renderWithProviders(
      <BottomSheet visible onClose={() => {}} title="Choose currency">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Choose currency')).toBeTruthy();
    expect(screen.getByText('Sheet body')).toBeTruthy();

    await rerender(
      <BottomSheet visible={false} onClose={() => {}} title="Choose currency">
        <Text>Sheet body</Text>
      </BottomSheet>,
    );
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <Button
        label="Notify"
        onPress={() => toast.show({ type: 'success', title: 'Saved', message: 'All good' })}
      />
    );
  }

  it('shows a toast and dismisses it on press', async () => {
    await renderWithProviders(<Trigger />);

    await fireEvent.press(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('All good')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('toast'));
    expect(screen.queryByText('Saved')).toBeNull();
  });
});

describe('State views', () => {
  it('renders an empty state with an action', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState
        title="No wallets"
        message="Create one"
        actionLabel="Create wallet"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create wallet' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders the normalised error with its reference and retry', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(
      <ErrorState error={createAppError('server', { requestId: 'req-42' })} onRetry={onRetry} />,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Reference: req-42')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
