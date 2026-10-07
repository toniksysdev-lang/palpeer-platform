import { View } from 'react-native';

import { AppText } from './AppText';
import { TextLink } from './TextLink';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
};

/** A section title with an optional link on the right, e.g. "Recent Transactions · see all". */
export function SectionHeader({ title, actionLabel, onAction, actionTestID }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <AppText variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <TextLink label={actionLabel} tone="info" onPress={onAction} testID={actionTestID} />
      ) : null}
    </View>
  );
}
