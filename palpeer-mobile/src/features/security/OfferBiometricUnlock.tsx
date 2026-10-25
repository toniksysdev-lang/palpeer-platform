import { Fingerprint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import {
  useGetPinStatusQuery,
  useGetSecurityQuestionsQuery,
} from '@/services/api/securityApi';
import {
  getBiometricCapability,
  type BiometricCapability,
} from '@/services/biometrics/biometrics';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { biometricChanged } from '@/store/slices/appLockSlice';
import { biometricUnlockPromptCompleted } from '@/store/slices/preferencesSlice';

import { enableBiometricUnlock } from './biometricUnlock';
import { securityErrorMessage } from './errors';

/** Delay so Home can paint before the post-login biometric offer. */
const OFFER_DELAY_MS = 700;

/**
 * After PIN + security questions are done on first login, offer Fingerprint / Face ID unlock.
 * Subsequent cold starts use LockScreen; Login keeps a fingerprint button when the session is parked.
 */
export function OfferBiometricUnlock() {
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const userId = useAppSelector((state) => state.session.userId);
  const locked = useAppSelector((state) => state.appLock.locked);
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const prompted = useAppSelector((state) => state.preferences.biometricUnlockPrompted);
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const questions = useGetSecurityQuestionsQuery(undefined, {
    skip: !authenticated || !pinStatus.data?.pinSet,
  });

  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const securityReady =
    !!pinStatus.data?.pinSet && !!questions.data && questions.data.length > 0;

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((result) => {
      if (active) setCapability(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const eligible =
      authenticated &&
      !!userId &&
      !locked &&
      securityReady &&
      !biometricEnabled &&
      !prompted &&
      capability?.status === 'available';

    if (!eligible) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), OFFER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    authenticated,
    userId,
    locked,
    securityReady,
    biometricEnabled,
    prompted,
    capability,
  ]);

  const label =
    capability && capability.status !== 'unsupported' ? capability.label : 'Face ID or Fingerprint';

  const markPrompted = async () => {
    await preferencesStorage.setBiometricUnlockPrompted();
    dispatch(biometricUnlockPromptCompleted());
  };

  const dismiss = async () => {
    if (busy) return;
    setVisible(false);
    setError(null);
    await markPrompted();
  };

  const enable = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    const outcome = await enableBiometricUnlock(userId, label);
    if (outcome.status === 'enabled') {
      dispatch(biometricChanged(true));
      dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'DEVICES' }]));
      await markPrompted();
      setVisible(false);
      toast.show({ type: 'success', title: `${label} unlock is on` });
    } else if (outcome.status === 'error') {
      setError(securityErrorMessage(outcome.error));
    } else if (outcome.result === 'lockout') {
      setError(`${label} is locked after too many attempts. Unlock your phone and try again.`);
    } else if (outcome.result === 'cancelled') {
      // Keep the dialog open so they can try again or choose Not now.
    } else {
      setError(`We couldn't confirm ${label}. Try again.`);
    }
    setBusy(false);
  };

  return (
    <AppModal
      visible={visible}
      onClose={() => void dismiss()}
      title={`Turn on ${label} unlock?`}
      dismissible={!busy}
      testID="biometric-offer"
    >
      <View style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
        <Icon icon={Fingerprint} size="xl" color={theme.colors.primary} />
      </View>
      <AppText tone="secondary">
        After this login, unlock Palpeer with {label} instead of entering your password each time
        you open the app.
      </AppText>
      <FormAlert message={error} testID="biometric-offer-error" />
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Button
          label={`Enable ${label}`}
          shape="pill"
          onPress={() => void enable()}
          loading={busy}
          loadingLabel="Setting up…"
          testID="biometric-offer-enable"
        />
        <Button
          label="Not now"
          variant="ghost"
          onPress={() => void dismiss()}
          disabled={busy}
          testID="biometric-offer-dismiss"
        />
      </View>
    </AppModal>
  );
}
