import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { toneColors, type Tone } from '@/theme';

import { useTheme } from './ThemeProvider';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastOptions, 'type' | 'title' | 'durationMs'>> & {
  id: number;
  message?: string;
};

type ToastApi = {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE: Record<ToastType, Tone> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
};

const ICON: Record<ToastType, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

/** One toast at a time; a new toast replaces the current one so messages never stack up. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const counter = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    setCurrent({
      id: counter.current,
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      durationMs: options.durationMs ?? 3500,
    });
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? <ToastView key={current.id} toast={current} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fg, bg } = toneColors(theme, TONE[toast.type]);

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.durationMs, onDismiss]);

  return (
    <Animated.View
      entering={FadeInUp.duration(theme.motion.base)}
      exiting={FadeOutUp.duration(theme.motion.base)}
      style={[styles.container, { top: insets.top + theme.spacing.sm }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityHint="Tap to dismiss"
        testID="toast"
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.md,
            gap: theme.spacing.md,
          },
          theme.shadows.raised,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: bg, borderRadius: theme.radius.pill }]}>
          <Icon icon={ICON[toast.type]} size="md" color={fg} />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong">{toast.title}</AppText>
          {toast.message ? (
            <AppText variant="caption" tone="secondary">
              {toast.message}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, zIndex: 200 },
  toast: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
