import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { NumberPadDock } from '@/components/ui/NumberPadContext';
import { typeOnNumberPad } from '@/tests/numberPad';
import { renderWithProviders } from '@/tests/render';

import { AmountInput, sanitizeAmount } from '../AmountInput';
import { Input } from '../Input';
import { PasswordInput } from '../PasswordInput';

describe('Input', () => {
  it('labels the field and shows the error instead of the hint', async () => {
    await renderWithProviders(
      <Input label="Email address" hint="We never share it" error="Enter a valid email address" />,
    );

    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(screen.queryByText('We never share it')).toBeNull();
  });

  it('opens the shared number pad for digit fields', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <Input
            label="Institution"
            value={value}
            onChangeText={setValue}
            numberPad="digits"
            numberPadMaxLength={3}
            testID="institution"
          />
          <NumberPadDock />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    expect(screen.queryByTestId('number-pad-dock-grid')).toBeNull();
    await fireEvent.press(screen.getByTestId('institution'));
    await typeOnNumberPad('123');
    expect(screen.getByTestId('institution')).toHaveTextContent('123');
  });
});

describe('PasswordInput', () => {
  it('hides the value until the user toggles visibility', async () => {
    await renderWithProviders(<PasswordInput label="Password" />);

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});

describe('sanitizeAmount', () => {
  it.each([
    ['1234', 2, '1234'],
    ['12.345', 2, '12.34'],
    ['0012.5', 2, '12.5'],
    ['.5', 2, '0.5'],
    ['1,5', 2, '1.5'],
    ['1.2.3', 2, '1.23'],
    ['abc12x', 2, '12'],
    ['10.99', 0, '10'],
    ['0', 2, '0'],
    ['00', 2, '0'],
    ['5.', 2, '5.'],
  ])('sanitizes %p with precision %p to %p', (input, precision, expected) => {
    expect(sanitizeAmount(input, precision)).toBe(expected);
  });
});

describe('AmountInput', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return (
      <>
        <AmountInput
          label="Amount"
          value={value}
          onChangeText={setValue}
          precision={2}
          currencyCode="USD"
          testID="amount"
        />
        <NumberPadDock />
      </>
    );
  }

  it('keeps the value as a sanitized string and shows the currency', async () => {
    await renderWithProviders(<Harness />);

    await fireEvent.press(screen.getByTestId('amount'));
    await typeOnNumberPad('150.555');
    expect(screen.getByTestId('amount')).toHaveTextContent(/150\.55/);
    expect(screen.getByText('USD')).toBeTruthy();
  });
});
