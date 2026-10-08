import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SensitiveScreenGuard } from '@/hooks/useSensitiveScreen';
import { baseApi } from '@/services/api/baseApi';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch } from '@/store';

import { PinEntry } from './components/PinEntry';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from './errors';

type PromptOptions = { title?: string; message?: string };
type PinPromptApi = { requestPin: (options?: PromptOptions) => Promise<boolean> };

const PinPromptContext = createContext<PinPromptApi | null>(null);

/**
 * App-wide "confirm with your PIN" sheet. `requestPin` resolves true only after
 * POST /security/pin/verify succeeds; cancel, lockout or a missing PIN resolve false.
 * The server does not require a PIN on any endpoint yet (mobile-api-map §1.7), so this is a
 * client-side confirmation step.
 */
export function PinPromptProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [request, setRequest] = useState<PromptOptions | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
    setError(null);
    setBlocked(false);
    setVerifying(false);
  }, []);

  const requestPin = useCallback((options: PromptOptions = {}) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setError(null);
      setBlocked(false);
      setRequest(options);
    });
  }, []);

  const verify = async (pin: string) => {
    setVerifying(true);
    setError(null);
    const result = await securityCommands.verifyPin({ pin });
    setVerifying(false);
    if (result.ok) {
      finish(true);
      return;
    }
    if (isPinLocked(result.error)) {
      dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
      setBlocked(true);
      setError(pinLockedMessage());
    } else if (result.error.code === 'RESOURCE_NOT_FOUND') {
      setBlocked(true);
      setError(securityErrorMessage(result.error));
    } else {
      setError(securityErrorMessage(result.error));
    }
  };

  return (
    <PinPromptContext.Provider value={{ requestPin }}>
      {children}
      <BottomSheet
        visible={request !== null}
        onClose={() => finish(false)}
        dismissible={!verifying}
        testID="pin-prompt"
      >
        {request !== null ? <SensitiveScreenGuard /> : null}
        <PinEntry
          title={request?.title ?? 'Enter your PIN'}
          subtitle={request?.message}
          error={error}
          submitLabel="Confirm"
          loading={verifying}
          disabled={blocked}
          autoSubmit
          onSubmit={(pin) => void verify(pin)}
          testID="pin-prompt-entry"
          footer={
            <Button
              label={blocked ? 'Close' : 'Cancel'}
              variant="ghost"
              onPress={() => finish(false)}
              disabled={verifying}
              testID="pin-prompt-cancel"
            />
          }
        />
      </BottomSheet>
    </PinPromptContext.Provider>
  );
}

export function usePinPrompt(): PinPromptApi {
  const context = useContext(PinPromptContext);
  if (!context) throw new Error('usePinPrompt must be used inside PinPromptProvider');
  return context;
}
