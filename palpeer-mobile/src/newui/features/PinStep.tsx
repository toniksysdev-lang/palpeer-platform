import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Circle, Dots, H1, P, PinPad, Screen, TopBar, Txt } from '@/newui/ui/kit';

type PinConfirmResult =
  | boolean
  | { ok?: boolean; softFail?: boolean; [key: string]: unknown };

function isSoftFail(r: PinConfirmResult): boolean {
  return typeof r === 'object' && !!r && r.softFail === true;
}

function okResult(r: PinConfirmResult): boolean {
  return typeof r === 'boolean' ? r : !!r?.ok && !r.softFail;
}

/**
 * "Enter your PIN" step used before money moves.
 * With `confirmPin` / `confirmBiometric`, uses live security bridges; otherwise 0000 fails in prototype mode.
 * Return `{ softFail: true }` when auth succeeded but the follow-up action failed — do not count as Wrong PIN.
 */
export function PinStep({
  onBack,
  onDone,
  title = 'Enter your PIN',
  confirmPin,
  confirmBiometric,
  initialTries = 0,
}: {
  onBack: () => void;
  onDone: (result?: PinConfirmResult) => void;
  title?: string;
  confirmPin?: (pin: string) => Promise<PinConfirmResult>;
  confirmBiometric?: () => Promise<PinConfirmResult>;
  initialTries?: number;
}) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(initialTries);
  const [busy, setBusy] = useState(false);

  const succeed = (r?: PinConfirmResult) => {
    setPin('');
    setWrong(false);
    onDone(r);
  };

  const failPin = () => {
    setPin('');
    setWrong(true);
    setTries((t) => t + 1);
  };

  /** Auth OK but save/withdraw failed — leave PIN screen without burning a try. */
  const softFail = () => {
    setPin('');
    setWrong(false);
    onBack();
  };

  const press = async (d: string) => {
    if (busy) return;
    const v = pin + d;
    // Always paint the new digit first (including the 4th) before verify clears it.
    setPin(v);
    setWrong(false);
    if (v.length < 4) return;
    if (confirmPin) {
      setBusy(true);
      try {
        const r = await confirmPin(v);
        if (okResult(r)) succeed(r);
        else if (isSoftFail(r)) softFail();
        else failPin();
      } finally {
        setBusy(false);
      }
      return;
    }
    if (v === '0000') failPin();
    else succeed();
  };

  const finger = async () => {
    if (busy) return;
    if (confirmBiometric) {
      setBusy(true);
      try {
        const r = await confirmBiometric();
        if (okResult(r)) succeed(r);
        else if (isSoftFail(r)) softFail();
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      if (!has) return succeed();
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Palpeer' });
      if (r.success) succeed();
    } catch {
      succeed();
    }
  };

  if (tries >= 3)
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 20 }}>
          <Circle icon="lock" bg="#B3231A" />
          <H1 center>Your PIN is locked</H1>
          <P center>Wrong PIN 3 times. No money moved. Answer your 2 security questions to get back in.</P>
        </View>
        <View style={{ flex: 1 }} />
        <Btn label="Reset your PIN" onPress={() => router.replace('/PinReset')} />
        <Btn kind="outline" size="mid" label="Go home" onPress={() => router.replace('/Main')} />
      </Screen>
    );

  return (
    <Screen gap={12}>
      <TopBar onBack={onBack} say="Enter your 4 number PIN, or use your fingerprint." />
      <H1>{title}</H1>
      <Dots n={pin.length} />
      <Txt size={17} w="700" color={wrong ? 'red' : 'text2'} center role={wrong ? 'alert' : undefined}>
        {wrong ? 'Wrong PIN. ' + (3 - tries) + (tries === 2 ? ' try left.' : ' tries left.') : '4 numbers, or tap the fingerprint'}
      </Txt>
      <View style={{ flex: 1 }} />
      <PinPad onKey={press} onDel={() => { setPin(pin.slice(0, -1)); setWrong(false); }} left={{ label: 'Finger', onPress: finger }} />
      <Btn kind="link" label="Forgot your PIN?" onPress={() => router.push('/PinReset')} />
    </Screen>
  );
}
