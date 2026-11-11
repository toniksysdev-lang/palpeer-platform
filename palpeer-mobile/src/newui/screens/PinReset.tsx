import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Circle, Field, H1, P, Screen, TopBar, Txt } from '@/newui/ui/kit';

type OkErr = { ok: true } | { ok: false; error: string; locked?: boolean };

export type PinResetProps = {
  backend?: boolean;
  q1Text?: string;
  q2Text?: string;
  questionsReady?: boolean;
  questionsLoading?: boolean;
  busy?: boolean;
  error?: string | null;
  clearError?: () => void;
  verifyAnswers?: (a1: string, a2: string) => Promise<OkErr>;
  resetPin?: (pin: string) => Promise<OkErr>;
  go?: (href: string) => void;
};

/** Reset PIN with 2 security questions — wired to useLivePinReset. */
export default function PinReset(props: PinResetProps) {
  const [stage, setStage] = useState<'ask' | 'new' | 'stuck' | 'done'>('ask');
  const [a1, setA1] = useState('');
  const [a2, setA2] = useState('');
  const [wrong, setWrong] = useState(false);
  const [tries, setTries] = useState(0);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4);
  const full = /^\d{4}$/.test(p1) && /^\d{4}$/.test(p2);
  const diff = full && p1 !== p2;
  const q1 = props.q1Text ?? 'What was the name of your first pet?';
  const q2 = props.q2Text ?? 'What was the name of your first school?';
  const apiWrong = props.backend ? !!props.error : wrong;
  const wrongText =
    props.backend && props.error
      ? props.error
      : 'These answers do not match. ' + (3 - tries) + (tries === 2 ? ' try left.' : ' tries left.');
  const busy = props.backend && !!props.busy;

  if (stage === 'stuck')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="lock" bg="#B3231A" />
          <H1 center>Customer service must help</H1>
          <P center>Your answers were wrong 3 times. Your money is safe.</P>
        </View>
        <Btn label="Contact customer service" onPress={() => router.replace('/MoreHelp')} />
      </Screen>
    );
  if (stage === 'done')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="check" />
          <H1 center>Your PIN is ready</H1>
          <P center>You can use your new PIN now.</P>
        </View>
        <Btn label="Go home" onPress={() => router.replace('/Main')} />
      </Screen>
    );
  if (stage === 'new')
    return (
      <Screen scroll>
        <TopBar onBack={() => setStage('ask')} />
        <H1>Make a new PIN</H1>
        <Card>
          <Field label="My new 4 numbers" value={p1} onChangeText={(v) => setP1(digits(v))} keyboardType="number-pad" secureTextEntry maxLength={4} big center />
          <Field label="Enter them again" value={p2} onChangeText={(v) => setP2(digits(v))} keyboardType="number-pad" secureTextEntry maxLength={4} big center />
          {diff ? (
            <Txt size={16} w="700" color="red" role="alert">
              The two PINs are not the same.
            </Txt>
          ) : null}
          {props.error ? (
            <Txt size={16} w="700" color="red" role="alert">
              {props.error}
            </Txt>
          ) : null}
        </Card>
        <View style={{ flex: 1 }} />
        <Btn
          label="Save your PIN"
          busy={busy}
          disabled={!full || diff}
          onPress={async () => {
            if (props.backend && props.resetPin) {
              const r = await props.resetPin(p1);
              if (r.ok) setStage('done');
              return;
            }
            setStage('done');
          }}
        />
      </Screen>
    );
  return (
    <Screen scroll>
      <TopBar say="Reset your PIN. Answer the 2 questions you set when you joined." />
      <H1>Reset your PIN</H1>
      <P>Answer the 2 questions you set when you joined.</P>
      {props.questionsLoading ? <P>Loading your questions…</P> : null}
      <Card>
        <Field
          label={q1}
          value={a1}
          onChangeText={(v) => {
            props.clearError?.();
            setA1(v);
            setWrong(false);
          }}
        />
        <Field
          label={q2}
          value={a2}
          onChangeText={(v) => {
            props.clearError?.();
            setA2(v);
            setWrong(false);
          }}
        />
        {apiWrong ? (
          <Txt size={16} w="700" color="red" role="alert">
            {wrongText}
          </Txt>
        ) : null}
      </Card>
      <View style={{ flex: 1 }} />
      <Btn
        label="Continue"
        busy={busy || !!props.questionsLoading}
        disabled={!a1.trim() || !a2.trim() || (props.backend && props.questionsReady === false)}
        onPress={async () => {
          if (props.backend && props.verifyAnswers) {
            const r = await props.verifyAnswers(a1, a2);
            if (r.ok) {
              setTries(0);
              setStage('new');
            } else if (r.locked) setStage('stuck');
            else {
              setTries(tries + 1);
              setWrong(true);
            }
            return;
          }
          if (!/wrong/i.test(a1 + a2)) {
            setTries(0);
            setStage('new');
          } else if (tries + 1 >= 3) setStage('stuck');
          else {
            setTries(tries + 1);
            setWrong(true);
          }
        }}
      />
      <Btn kind="link" label="Forgot? Contact customer service" onPress={() => router.replace('/MoreHelp')} />
    </Screen>
  );
}
