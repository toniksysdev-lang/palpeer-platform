import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '@/newui/lib/store';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Circle, Divider, Field, H1, H2, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';
import { EASY, PASS_NOW, PAST, PIN_NOW } from '../moreData';

const DoneView = ({ title, text, onDone }: { title: string; text: string; onDone: () => void }) => (
  <Screen>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Circle icon="check" />
      <H1 center>{title}</H1>
      <P center>{text}</P>
    </View>
    <Btn label="Done" onPress={onDone} />
  </Screen>
);

/** Change my PIN: current PIN (3 tries), new PIN twice, no easy PINs, must differ. Sample current PIN: 1234. */
export function MyPin({ onBack, onLeave }: { onBack: () => void; onLeave?: () => void }) {
  const [old, setOld] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [tries, setTries] = useState(0);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const d4 = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4);
  if (done) return <DoneView title="Your PIN is changed" text="You use your new PIN from now on." onDone={onBack} />;
  const save = () => {
    if (old !== PIN_NOW) {
      const t = tries + 1;
      setTries(t);
      setOld('');
      return setErr(t >= 3 ? 'Wrong PIN 3 times. Your PIN is locked.' : 'Your PIN now is not right. ' + (3 - t) + (3 - t === 1 ? ' try left.' : ' tries left.'));
    }
    if (p1 === old) return setErr('The new PIN must be different.');
    if (EASY.includes(p1)) return setErr('This PIN is too easy to guess. Choose other numbers.');
    if (p1 !== p2) return setErr('The new PINs are not the same.');
    setDone(true);
  };
  return (
    <Screen scroll>
      <TopBar onBack={onBack} say="Change your PIN. Type your PIN now, then your new 4 numbers two times. Do not use easy numbers like 1 2 3 4." />
      <H1>Change your PIN</H1>
      <P>4 numbers. Do not use easy ones like 1234 or 1111. Do not tell anyone.</P>
      <Card>
        <Field label="My PIN now" value={old} onChangeText={(v) => { setOld(d4(v)); setErr(''); }} keyboardType="number-pad" secureTextEntry maxLength={4} />
        <Field label="My new PIN" value={p1} onChangeText={(v) => { setP1(d4(v)); setErr(''); }} keyboardType="number-pad" secureTextEntry maxLength={4} />
        <Field label="New PIN again" value={p2} onChangeText={(v) => { setP2(d4(v)); setErr(''); }} keyboardType="number-pad" secureTextEntry maxLength={4} />
        {err ? (
          <Txt size={16} w="700" color="red" role="alert">
            {err}
          </Txt>
        ) : null}
        {tries >= 3 ? <Btn kind="outline" size="small" label="Reset with your security questions" onPress={() => { onLeave?.(); router.push('/PinReset'); }} /> : null}
      </Card>
      <View style={{ flex: 1 }} />
      <Btn label="Save your new PIN" disabled={old.length !== 4 || p1.length !== 4 || p2.length !== 4 || tries >= 3} onPress={save} />
    </Screen>
  );
}

/** Change my password: 8 to 128 characters, different, typed twice. Sample current password: sample123. */
export function MyPassword({ onBack }: { onBack: () => void }) {
  const [old, setOld] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  if (done) return <DoneView title="Your password is changed" text="You use your new password next time you log in." onDone={onBack} />;
  const save = () => {
    if (old !== PASS_NOW) return setErr('Your password now is not right.');
    if (p1.length < 8 || p1.length > 128) return setErr('The new password needs 8 to 128 letters or numbers.');
    if (p1 === old) return setErr('The new password must be different.');
    if (p1 !== p2) return setErr('The new passwords are not the same.');
    setDone(true);
  };
  return (
    <Screen scroll>
      <TopBar onBack={onBack} say="Change your password. Type your password now, then a new one of at least 8 letters or numbers, two times." />
      <H1>Change your password</H1>
      <P>At least 8 letters or numbers. Not the same as now.</P>
      <Card>
        <Field label="My password now" value={old} onChangeText={(v) => { setOld(v); setErr(''); }} secureTextEntry={!show} autoCapitalize="none" />
        <Field label="My new password" value={p1} onChangeText={(v) => { setP1(v); setErr(''); }} secureTextEntry={!show} autoCapitalize="none" maxLength={128} />
        <Field label="New password again" value={p2} onChangeText={(v) => { setP2(v); setErr(''); }} secureTextEntry={!show} autoCapitalize="none" maxLength={128} />
        <Btn kind="link" label={show ? 'Hide' : 'Show'} onPress={() => setShow(!show)} />
        {err ? (
          <Txt size={16} w="700" color="red" role="alert">
            {err}
          </Txt>
        ) : null}
      </Card>
      <View style={{ flex: 1 }} />
      <Btn label="Save your new password" disabled={!old || !p1 || !p2} onPress={save} />
    </Screen>
  );
}

/** Fingerprint or face: turning it off needs both security questions (3 tries). */
export function Finger({ onBack, onContact }: { onBack: () => void; onContact: () => void }) {
  const c = useC();
  const [on, setOn] = useState(true);
  const [step, setStep] = useState<'home' | 'ask' | 'stuck' | 'off' | 'on'>('home');
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [tries, setTries] = useState(0);
  const [err, setErr] = useState(false);
  if (step === 'off') return <DoneView title="Fingerprint is off" text="You use your PIN to move money and to open the app." onDone={onBack} />;
  if (step === 'on') return <DoneView title="Fingerprint is on" text="You can use your finger or face to open the app and move money." onDone={onBack} />;
  if (step === 'stuck')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Circle icon="lock" bg="#B3231A" />
          <H1 center>Customer service must help</H1>
          <P center>Your answers were wrong 3 times. Fingerprint stays on. Your money is safe.</P>
        </View>
        <Btn label="Contact customer service" onPress={onContact} />
      </Screen>
    );
  if (step === 'ask')
    return (
      <Screen scroll>
        <TopBar onBack={() => setStep('home')} say="Answer your 2 security questions to turn off fingerprint." />
        <H1>Answer your questions</H1>
        <P>Small or capital letters do not matter.</P>
        <Card>
          <Field label="What was the name of your first school?" value={q1} onChangeText={(v) => { setQ1(v); setErr(false); }} />
          <Field label="What was the name of your first pet?" value={q2} onChangeText={(v) => { setQ2(v); setErr(false); }} />
          {err ? (
            <Txt size={16} w="700" color="red" role="alert">
              {'These answers do not match. ' + (3 - tries) + (3 - tries === 1 ? ' try left.' : ' tries left.')}
            </Txt>
          ) : null}
        </Card>
        <View style={{ flex: 1 }} />
        <Btn
          label="Turn it off"
          disabled={!q1.trim() || !q2.trim()}
          onPress={() => {
            if (!/wrong/i.test(q1 + q2)) {
              setOn(false);
              return setStep('off');
            }
            const t = tries + 1;
            setTries(t);
            if (t >= 3) setStep('stuck');
            else setErr(true);
          }}
        />
      </Screen>
    );
  return (
    <Screen>
      <TopBar onBack={onBack} say={on ? 'Fingerprint is on. To turn it off, answer your 2 security questions.' : 'Fingerprint is off. You can turn it on.'} />
      <H1>Fingerprint or face</H1>
      <Card>
        <Row between>
          <View style={{ flex: 1 }}>
            <Txt size={20} w="800">
              {on ? 'On' : 'Off'}
            </Txt>
            <Txt size={16} color="text2">
              {on ? 'You open the app and move money with your finger or face.' : 'You use your PIN.'}
            </Txt>
          </View>
          <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: on ? '#0B6E4F' : '#46574F' }}>
            <Txt size={16} w="800" color="#FFFFFF">
              {on ? 'On' : 'Off'}
            </Txt>
          </View>
        </Row>
      </Card>
      <P>To turn it off, you must answer your 2 security questions first.</P>
      <View style={{ flex: 1 }} />
      <Btn
        label={on ? 'Turn it off' : 'Turn it on'}
        style={{ backgroundColor: on ? c.redFill : c.brand }}
        onPress={() => {
          if (on) setStep('ask');
          else {
            setOn(true);
            setStep('on');
          }
        }}
      />
    </Screen>
  );
}

/** Where I am signed in: one active device only, blocked tries, earlier sign-ins. */
export function Phones({ onBack, onNotMe }: { onBack: () => void; onNotMe: () => void }) {
  const c = useC();
  const st = useStore();
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say="You are signed in on this phone only. No other phone can log in while you are signed in. One blocked try from an iPhone in Lagos." />
      <H1>Where you are signed in</H1>
      <Card gap={2} style={{ borderWidth: 3, borderColor: c.brandText }}>
        <Txt size={15} w="800" color="brandText">
          Signed in now, this phone
        </Txt>
        <Txt size={20} w="800" noTr>
          Samsung Galaxy A54
        </Txt>
        <Txt size={16} color="text2" noTr>
          Halifax, Nova Scotia, Canada
        </Txt>
        <Txt size={15} color="text3">
          Since today, 2:40 am
        </Txt>
      </Card>
      <P>Only this phone can be signed in. While you are signed in here, no other phone or place can log in.</P>
      <H2>Unusual tries</H2>
      <Card gap={4} bg={c.warnBg}>
        <Row between>
          <Txt size={18} w="800" noTr>
            iPhone 13
          </Txt>
          <Txt size={15} w="800" color="red">
            Blocked
          </Txt>
        </Row>
        <Txt size={15} color="text2">
          Lagos, Nigeria · Yesterday, 9:12 pm
        </Txt>
        <Txt size={15} color="text2">
          Unknown phone and a new country
        </Txt>
        <Btn size="small" kind="outline" label="Not you? Tell us" onPress={onNotMe} style={{ borderColor: c.red }} />
      </Card>
      <H2>My trusted phone: earlier sign-ins</H2>
      <Card gap={6}>
        {PAST.map((d, i) => (
          <View key={i} style={{ gap: 2 }}>
            {i ? <Divider /> : null}
            <Txt size={17} w="800" noTr>
              {d.device}
            </Txt>
            <Txt size={15} color="text2">
              {d.where}
            </Txt>
          </View>
        ))}
      </Card>
      <Btn
        kind="outline"
        size="mid"
        label="Sign out of this phone"
        onPress={() => {
          st.set({ signedIn: false });
          router.replace({ pathname: '/', params: { stage: 'login' } } as Href);
        }}
      />
    </Screen>
  );
}
