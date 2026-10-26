import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { NumberPadDock } from '@/components/ui/NumberPadContext';
import { renderWithProviders } from '@/tests/render';

import { AmountInput, formatAmountDisplay, sanitizeAmount } from '../AmountInput';
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

  it('accepts a pasted digit string without using the system keypad props', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <Input
            label="Account number"
            value={value}
            onChangeText={setValue}
            numberPad="digits"
            numberPadMaxLength={10}
            testID="account"
          />
          <NumberPadDock />
        </>
      );
    }

    await renderWithProviders(<Harness />);
    const field = screen.getByTestId('account');
    expect(field.props.showSoftInputOnFocus).toBe(false);
    expect(field.props.inputMode).toBe('none');
    await fireEvent.changeText(field, '1234567890');
    expect(field.props.value).toBe('1234567890');
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
    ['1,250.999', 2, '1250.99'],
    ['1.250,99', 2, '1250.99'],
    ['1,250', 2, '1250'],
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

describe('formatAmountDisplay', () => {
  it('groups thousands and pads decimals when blurred', () => {
    expect(formatAmountDisplay('1234.5', 2, { padFraction: true })).toBe('1,234.50');
    expect(formatAmountDisplay('100', 2, { padFraction: true })).toBe('100.00');
  });

  it('keeps a trailing dot while editing', () => {
    expect(formatAmountDisplay('5.', 2, { padFraction: false })).toBe('5.');
  });

  it('does not pad typed decimals unless padFraction is set', () => {
    expect(formatAmountDisplay('0.00', 6, { padFraction: false })).toBe('0.00');
    expect(formatAmountDisplay('0.00', 6, { padFraction: true })).toBe('0.000000');
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

    expect(screen.queryByTestId('number-pad-dock-grid')).toBeNull();
    const field = screen.getByTestId('amount');
    await fireEvent.changeText(field, '150.555');
    expect(field.props.value).toBe('150.55');
    expect(screen.getByText('USD')).toBeTruthy();
  });

  it('accepts a pasted amount and keeps the OS keypad suppressed', async () => {
    await renderWithProviders(<Harness />);
    const field = screen.getByTestId('amount');
    expect(field.props.showSoftInputOnFocus).toBe(false);
    expect(field.props.inputMode).toBe('none');
    await fireEvent.changeText(field, '1,250.999');
    expect(field.props.value).toBe('1,250.99');
  });
});
