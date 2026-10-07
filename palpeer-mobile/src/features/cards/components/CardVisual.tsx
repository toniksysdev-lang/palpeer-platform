import { LinearGradient } from 'expo-linear-gradient';
import { Snowflake } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { CardResponse } from '@/types/api/card';

import { expiryLabel, isTestCard, maskedNumber } from '../logic';

const ON_CARD = '#FFFFFF';
const FROZEN = ['#5B6770', '#8A969E'] as const;

/**
 * The card face. Built only from non-sensitive fields: the number is masked to its last four
 * digits and there is no CVV anywhere in the contract.
 */
export function CardVisual({ card, compact = false }: { card: CardResponse; compact?: boolean }) {
  const theme = useTheme();
  const frozen = card.status === 'BLOCKED';
  const inactive = card.status === 'CLOSED' || card.status === 'PENDING';
  const colors =
    frozen || inactive ? FROZEN : ([theme.colors.gradientStart, theme.colors.gradientEnd] as const);
  const number = maskedNumber(card.lastFour);

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.face,
        {
          borderRadius: theme.radius.lg,
          padding: compact ? theme.spacing.md : theme.spacing.lg,
          minHeight: compact ? 120 : 190,
          opacity: inactive ? 0.75 : 1,
        },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${card.brand} card ending ${card.lastFour.slice(-4)}${frozen ? ', frozen' : ''}`}
      testID={`card-visual-${card.id}`}
    >
      <View style={styles.row}>
        <AppText variant="overline" style={{ color: ON_CARD }}>
          {card.currencyCode}
        </AppText>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          {isTestCard(card) ? (
            <View
              style={[styles.pill, { borderRadius: theme.radius.pill }]}
              testID={`card-test-label-${card.id}`}
            >
              <AppText variant="caption" style={{ color: ON_CARD }}>
                Test card
              </AppText>
            </View>
          ) : null}
          {frozen ? <Icon icon={Snowflake} size={18} color={ON_CARD} /> : null}
        </View>
      </View>
      <AppText
        variant={compact ? 'h3' : 'h2'}
        style={{ color: ON_CARD, letterSpacing: 2 }}
        testID={`card-number-${card.id}`}
      >
        {number}
      </AppText>
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <View style={{ flex: 1, gap: 2 }}>
          {!compact && card.cardholderName ? (
            <AppText variant="bodyStrong" style={{ color: ON_CARD }} numberOfLines={1}>
              {card.cardholderName}
            </AppText>
          ) : null}
          <AppText variant="caption" style={{ color: ON_CARD }}>
            Expires {expiryLabel(card)}
          </AppText>
        </View>
        <AppText variant="h3" style={{ color: ON_CARD, fontStyle: 'italic' }}>
          {card.brand}
        </AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  face: { justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 8, paddingVertical: 2 },
});
