import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { Btn, Circle, Dots, Field, H1, NumberPadSlot, P, PinPad, Screen, TopBar, Txt } from '@/newui/ui/kit';

type OkErr =
  | { ok: true; cooldownSec?: number; needsOtp?: boolean }
  | { ok: false; error?: string; needsOtp?: boolean };

type Props = {
  backend?: boolean;
  error?: string | null;
  busy?: boolean;
  needsOtp?: boolean;
  mailMask?: string;
  bioAvailable?: boolean;
  bioLabel?: string;
  clearError?: () => void;
  onUnlockBio?: () => Promise<OkErr>;
  confirmPin?: (pin: string) => Promise<OkErr>;
  onSendCode?: () => Promise<OkErr>;
  onVerifyCode?: (code: string) => Promise<OkErr>;
  goPinReset?: () => void;
  goHome?: () => void;
};

/** New-device confirm: biometrics / PIN, then email OTP when needed. */
export default function ConfirmPin(props: Props) {
  const numberPad = useOptionalNumberPad();
  const [mode, setMode] = useState<'choose' | 'pin' | 'otp'>('choose');
  const [pin, setPin] = useState('');
  const [ecode, setEcode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(0);
  const [localBusy, setLocalBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const busy = !!props.busy || localBusy;
  const err = props.error;

  useEffect(() => {
    if (props.needsOtp && mode !== 'otp') {
      setMode('otp');
      setWrong(false);
      setEcode('');
      setResendLeft(45);
    }
  }, [props.needsOtp, mode]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendLeft]);

  const handleResult = (r: OkErr | undefined) => {
    if (r?.ok) {
      if (r.needsOtp) {
        setMode('otp');
        setWrong(false);
        setEcode('');
        setResendLeft(r.cooldownSec || 45);
      }
      return;
    }
    setWrong(true);
  };

  const unlockBio = async () => {
    if (busy) return;
    props.clearError?.();
    setLocalBusy(true);
    setWrong(false);
    try {
      const r = await props.onUnlockBio?.();
      handleResult(r);
    } finally {
      setLocalBusy(false);
    }
  };

  const press = async (d: string) => {
    if (busy || tries >= 3) return;
    const next = pin + d;
    if (next.length < 4) {
      setPin(next);
      setWrong(false);
      return;
    }
    setLocalBusy(true);
    setPin(next);
    setWrong(false);
    props.clearError?.();
    try {
      const r = await props.confirmPin?.(next);
      if (r?.ok) {
        handleResult(r);
        if (r.needsOtp) setPin('');
        return;
      }
      setPin('');
      setWrong(true);
      setTries((t) => t + 1);
    } finally {
      setLocalBusy(false);
    }
  };

  const submitCode = async (code: string) => {
    if (busy || code.length < 6) return;
    setLocalBusy(true);
    setWrong(false);
    props.clearError?.();
    try {
      const r = await props.onVerifyCode?.(code);
      if (r?.ok) return;
      setEcode('');
      setWrong(true);
    } finally {
      setLocalBusy(false);
    }
  };

  const resend = async () => {
    if (busy || resendLeft > 0) return;
    const r = await props.onSendCode?.();
    if (r?.ok) setResendLeft(r.cooldownSec || 45);
  };

  if (mode === 'otp') {
    const otpPadOpen = numberPad?.active?.id === 'confirm-email-code';
    return (
      <Screen style={{ paddingBottom: 0 }} gap={12}>
        <TopBar onBack={() => setMode('choose')} say={`Enter the 6-digit code we sent to ${props.mailMask || 'your email'}.`} />
        <View
          style={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            gap: 12,
            justifyContent: otpPadOpen ? 'flex-end' : 'flex-start',
          }}
        >
          {!otpPadOpen ? (
            <>
              <Circle icon="chat" />
              <H1>Check your email</H1>
              <P noTr>{`We sent a 6-digit code to ${props.mailMask || 'your email'}. Enter it to move this account to this phone.`}</P>
            </>
          ) : null}
          <Field
            label="6-digit code"
            value={ecode}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 6);
              setEcode(v);
              setWrong(false);
              if (v.length === 6) void submitCode(v);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            big
            center
            maxLength={6}
            padKey="confirm-email-code"
            autoFocus={otpPadOpen}
          />
          {wrong || err ? (
            <Txt size={16} w="700" color="red" role="alert" noTr>
              {err || 'That code did not work. Try again.'}
            </Txt>
          ) : null}
          <Btn
            size="mid"
            kind="outline"
            label={resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend code'}
            disabled={busy || resendLeft > 0}
            onPress={() => void resend()}
          />
        </View>
        <NumberPadSlot forId="confirm-email-code" />
      </Screen>
    );
  }

  if (mode === 'pin') {
    return (
      <Screen gap={12}>
        <TopBar onBack={() => setMode('choose')} say="Enter your 4-digit PIN to confirm it is you." />
        <Circle icon="lock" />
        <H1>Enter your PIN</H1>
        <Dots n={pin.length} of={4} />
        {wrong || err ? (
          <Txt size={16} w="700" color="red" center role="alert" noTr>
            {err || (tries >= 3 ? 'Too many tries. Reset your PIN.' : 'Wrong PIN. Try again.')}
          </Txt>
        ) : (
          <P center>Confirm it is you on this phone.</P>
        )}
        <View style={{ flex: 1, minHeight: 0 }} />
        {tries >= 3 ? (
          <Btn size="mid" label="Reset PIN" onPress={() => props.goPinReset?.()} />
        ) : (
          <PinPad onKey={(k) => void press(k)} onDel={() => setPin((p) => p.slice(0, -1))} />
        )}
      </Screen>
    );
  }

  return (
    <Screen gap={12}>
      <TopBar onBack={false} say="Confirm it is you. Use face or fingerprint, or your PIN." />
      <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
        <Circle icon="shield" />
        <H1 center>Confirm it is you</H1>
        <P center>This account is opening on a new phone. Confirm with face, fingerprint, or your PIN.</P>
      </View>
      {wrong || err ? (
        <Txt size={16} w="700" color="red" center role="alert" noTr>
          {err || "We couldn't confirm it's you. Try again."}
        </Txt>
      ) : null}
      <View style={{ flex: 1 }} />
      {props.bioAvailable !== false ? (
        <Btn
          size="mid"
          icon="finger"
          label={busy ? 'Checking…' : props.bioLabel || 'Face or Fingerprint'}
          disabled={busy}
          onPress={() => void unlockBio()}
        />
      ) : null}
      <Btn size="mid" kind="outline" label="Use PIN" disabled={busy} onPress={() => setMode('pin')} />
      <Btn kind="link" label="Reset PIN" onPress={() => props.goPinReset?.()} />
    </Screen>
  );
}
