import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { NumberPadDock } from '@/components/ui/NumberPadContext';
import { typeIntoNumberField, typeOnNumberPad } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';

import { Input } from '../Input';
import { NumberPad } from '../NumberPad';
import { AmountInput } from '../AmountInput';

describe('NumberPad', () => {
  it('renders a full 3×4 grid with equal keys', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return <NumberPad value={value} onChange={setValue} bottomLeft="*" testID="pad" />;
    }

    await renderWithProviders(<Harness />);
    expect(screen.getByTestId('pad-grid')).toBeTruthy();
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', 'back']) {
      expect(screen.getByTestId(`pad-key-${key}`)).toBeTruthy();
    }
  });

  it('accepts digits and deletes; * is decorative', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <NumberPad value={value} onChange={setValue} bottomLeft="*" testID="pad" />
          <Input label="Mirror" value={value} onChangeText={setValue} testID="mirror" />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    await typeOnNumberPad('508*', 'pad');
    expect(screen.getByTestId('mirror').props.value).toBe('508');
    await fireEvent.press(screen.getByTestId('pad-key-back'));
    expect(screen.getByTestId('mirror').props.value).toBe('50');
  });

  it('supports a decimal bottom-left key', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <NumberPad value={value} onChange={setValue} bottomLeft="." testID="pad" />
          <Input label="Mirror" value={value} onChangeText={setValue} testID="mirror" />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    await typeOnNumberPad('12.5', 'pad');
    expect(screen.getByTestId('mirror').props.value).toBe('12.5');
    await fireEvent.press(screen.getByTestId('pad-key-dot'));
    expect(screen.getByTestId('mirror').props.value).toBe('12.5');
  });

  it('stays hidden until a pad-backed field is tapped', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <Input
            label="Code"
            value={value}
            onChangeText={setValue}
            numberPad="digits"
            numberPadMaxLength={4}
            testID="code"
          />
          <NumberPadDock />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    expect(screen.queryByTestId('number-pad-dock-grid')).toBeNull();
    await typeIntoNumberField('code', '9042');
    expect(screen.getByTestId('code')).toHaveTextContent('9042');
    expect(screen.getByTestId('number-pad-dock-key-*')).toBeTruthy();
    expect(screen.getByTestId('number-pad-dock-key-back')).toBeTruthy();
  });

  it('shows a decimal key for amount fields', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <AmountInput
            label="Amount"
            value={value}
            onChangeText={setValue}
            precision={2}
            testID="amount"
          />
          <NumberPadDock />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    await typeIntoNumberField('amount', '99.5');
    expect(screen.getByTestId('amount')).toHaveTextContent(/99\.5/);
    expect(screen.getByTestId('number-pad-dock-key-dot')).toBeTruthy();
  });
});
