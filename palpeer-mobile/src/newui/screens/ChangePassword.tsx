import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Field, H1, P, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Props = {
  backend?: boolean;
  busy?: boolean;
  error?: string | null;
  onSubmit?: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onBack?: () => void;
};

/** Change password — newui, signs out everywhere on success. */
export default function ChangePassword(props: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => {
    if (props.onBack) props.onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  };

  const ok =
    current.trim().length >= 1 &&
    next.length >= 8 &&
    next.length <= 128 &&
    next === again;

  const submit = async () => {
    setLocalError(null);
    if (next !== again) {
      setLocalError('The passwords are not the same.');
      return;
    }
    if (next.length < 8) {
      setLocalError('Use at least 8 characters.');
      return;
    }
    if (!props.onSubmit) return;
    setBusy(true);
    try {
      const r = await props.onSubmit(current, next);
      if (!r.ok) setLocalError(r.error || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };

  const err = localError || props.error;

  return (
    <Screen scroll gap={12}>
      <TopBar
        onBack={back}
        say="Change password. After you change it you will be signed out on every device."
      />
      <H1>Change password</H1>
      <P>After changing your password you will be signed out on every device, including this one.</P>
      <Card gap={8}>
        <Field
          label="Current password"
          value={current}
          onChangeText={(v) => {
            setLocalError(null);
            setCurrent(v);
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
        />
        <Field
          label="New password (at least 8)"
          value={next}
          onChangeText={(v) => {
            setLocalError(null);
            setNext(v);
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
          maxLength={128}
        />
        <Field
          label="Type it again"
          value={again}
          onChangeText={(v) => {
            setLocalError(null);
            setAgain(v);
          }}
          secureTextEntry={!show}
          autoCapitalize="none"
          maxLength={128}
        />
        <Btn kind="link" label={show ? 'Hide' : 'Show'} onPress={() => setShow(!show)} />
        {err ? (
          <Txt size={16} w="700" color="red" role="alert" noTr>
            {err}
          </Txt>
        ) : null}
      </Card>
      <View style={{ flex: 1 }} />
      <Btn
        label="Change password"
        busy={busy || !!props.busy}
        disabled={!ok}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
