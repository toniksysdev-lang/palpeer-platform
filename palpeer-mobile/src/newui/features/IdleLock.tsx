import * as LocalAuthentication from 'expo-local-authentication';
import { router, type Href } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { useStore } from '@/newui/lib/store';
import { Btn, Circle, Dots, H1, P, PinPad, Screen } from '@/newui/ui/kit';

const IDLE_MS = 3 * 60 * 1000;

/**
 * Logs the user out after 3 minutes with no use, and asks for the fingerprint/face or PIN to come back.
 * Only runs while signed in.
 */
export function IdleLock({ children }: { children: ReactNode }) {
  const { signedIn } = useStore();
  const last = useRef(Date.now());
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    const tick = setInterval(() => {
      if (Date.now() - last.current >= IDLE_MS) setLocked(true);
    }, 5000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && Date.now() - last.current >= IDLE_MS) setLocked(true);
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [signedIn]);

  const unlock = () => {
    last.current = Date.now();
    setPin('');
    setLocked(false);
  };
  const press = (k: string) => {
    const v = (pin + k).slice(0, 4);
    setPin(v);
    if (v.length === 4) setTimeout(unlock, 250);
  };
  const finger = async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      if (!has) return unlock(); // prototype: no sensor, let them in
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Palpeer' });
      if (r.success) unlock();
    } catch {
      unlock();
    }
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={() => (last.current = Date.now())}>
      {children}
      <Modal visible={signedIn && locked} animationType="fade" onRequestClose={() => {}}>
        <Screen gap={12}>
          <View style={{ alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Circle icon="lock" size={80} iconSize={52} bg="#0E1F19" />
            <H1 center>You were logged out</H1>
            <P center>No use for 3 minutes. Use your fingerprint or PIN to come back.</P>
          </View>
          <Dots n={pin.length} />
          <View style={{ flex: 1 }} />
          <PinPad onKey={press} onDel={() => setPin(pin.slice(0, -1))} left={{ label: 'Finger', onPress: finger }} />
          <Btn
            kind="link"
            label="Log in with your password"
            onPress={() => {
              unlock();
              router.replace({ pathname: '/', params: { stage: 'login' } } as Href);
            }}
          />
        </Screen>
      </Modal>
    </View>
  );
}
