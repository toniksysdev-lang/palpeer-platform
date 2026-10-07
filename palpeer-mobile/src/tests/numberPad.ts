import { fireEvent, screen } from '@testing-library/react-native';

/** Presses digits / decimal on the shared screen number pad dock. */
export async function typeOnNumberPad(digits: string, testID = 'number-pad-dock') {
  for (const char of digits) {
    if (!/\d|\./.test(char)) continue;
    await fireEvent.press(await screen.findByTestId(`${testID}-key-${char}`));
  }
}

/** Focuses a pad-backed field, then types with the shared number pad. */
export async function typeIntoNumberField(fieldTestID: string, digits: string) {
  await fireEvent.press(await screen.findByTestId(fieldTestID));
  await typeOnNumberPad(digits);
}
