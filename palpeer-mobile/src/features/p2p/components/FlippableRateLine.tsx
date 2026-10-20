import { ArrowLeftRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

import { AppText, type TextTone, type TextVariant } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';

import { otherOfPair, preferredRateUnit, p2pRateLine } from '../logic';

/**
 * "1 CAD = 970 NGN" with a switch icon — tap to flip which currency stays at 1.
 * Safe inside pressable cards: the flip press does not bubble to the parent.
 */
export function FlippableRateLine({
  rate,
  base,
  quote,
  tone = 'secondary',
  variant = 'body',
  align = 'left',
  testID,
}: {
  rate: string;
  base: string;
  quote: string;
  tone?: TextTone;
  variant?: TextVariant;
  align?: 'left' | 'right';
  testID?: string;
}) {
  const theme = useTheme();
  const [rateUnit, setRateUnit] = useState(() => preferredRateUnit(base, quote));
  const rateLine = p2pRateLine(rate, base, quote, rateUnit);

  const flip = (event?: GestureResponderEvent) => {
    event?.stopPropagation?.();
    setRateUnit(otherOfPair(rateUnit, base, quote));
  };

  return (
    <Pressable
      onPress={flip}
      accessibilityRole="button"
      accessibilityLabel={`Exchange rate ${rateLine}. Tap to flip direction.`}
      testID={testID}
      style={{
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
        alignItems: 'center',
        alignSelf: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 6,
        flexShrink: 1,
      }}
    >
      <AppText tone={tone} variant={variant} style={{ flexShrink: 1 }}>
        {rateLine}
      </AppText>
      <Icon
        icon={ArrowLeftRight}
        size={16}
        color={theme.colors.primary}
        accessibilityLabel="Switch rate direction"
      />
      <AppText variant="caption" tone="muted">
        Switch
      </AppText>
    </Pressable>
  );
}
