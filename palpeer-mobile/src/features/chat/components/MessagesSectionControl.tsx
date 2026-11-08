import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';

export type MessagesSection = 'talks' | 'alerts';

type Props = {
  section: MessagesSection;
  onChange: (section: MessagesSection) => void;
};

/** Shared header for the Messages tab: title + Price talks / Alerts. */
export function MessagesSectionControl({ section, onChange }: Props) {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText variant="h1" accessibilityRole="header">
        {t('nav.messages')}
      </AppText>
      <SegmentedControl<MessagesSection>
        options={[
          { value: 'talks', label: t('messages.priceTalks') },
          { value: 'alerts', label: t('messages.alerts') },
        ]}
        value={section}
        onChange={onChange}
        accessibilityLabel={t('nav.messages')}
      />
    </View>
  );
}
