import { fireEvent, screen } from '@testing-library/react-native';

/** Types a PIN on a PinEntry's keypad and presses submit when that button is shown. */
export async function enterPin(entryTestID: string, pin: string) {
  for (const digit of pin) {
    await fireEvent.press(await screen.findByTestId(`${entryTestID}-pad-key-${digit}`));
  }
  const submit = screen.queryByTestId(`${entryTestID}-submit`);
  if (submit) {
    await fireEvent.press(submit);
  }
}

export const PIN_STATUS = (pinSet: boolean, lockedUntil: string | null = null) => ({
  pinSet,
  lockedUntil,
});

export const QUESTIONS = [
  { id: 'q-1', questionKey: 'FIRST_PET', questionText: 'What was the name of your first pet?' },
  { id: 'q-2', questionKey: 'BIRTH_TOWN', questionText: 'In which town were you born?' },
];
