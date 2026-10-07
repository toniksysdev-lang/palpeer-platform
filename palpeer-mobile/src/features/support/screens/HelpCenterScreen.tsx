import { ChevronDown, ChevronUp, Mail, Phone, Search, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { NavRow, RowSection } from '@/components/ui/NavRow';
import { appConfig } from '@/config/env';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';

import { openExternal, supportMailto, telUrl } from '../appInfo';
import { searchFaq, type FaqItem } from '../faq';

export function HelpCenterScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const sections = useMemo(() => searchFaq(query), [query]);

  return (
    <Screen scroll keyboardAware>
      <StackHeader title="Help & support" />
      <Input
        label="Search help"
        placeholder="e.g. PIN, password, bonus"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        left={<Icon icon={Search} size="md" color={theme.colors.textMuted} />}
        testID="help-search"
      />

      {sections.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching answers"
          message="Try other words, or contact support below."
        />
      ) : (
        sections.map((section) => (
          <RowSection key={section.id} title={section.title}>
            {section.items.map((item) => (
              <FaqEntry
                key={item.id}
                item={item}
                expanded={open === item.id || query.trim().length > 0}
                onToggle={() => setOpen((current) => (current === item.id ? null : item.id))}
              />
            ))}
          </RowSection>
        ))
      )}

      <ContactSupport />
    </Screen>
  );
}

function FaqEntry({
  item,
  expanded,
  onToggle,
}: {
  item: FaqItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={onToggle}
      accessibilityLabel={item.question}
      testID={`faq-${item.id}`}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {item.question}
          </AppText>
          <Icon icon={expanded ? ChevronUp : ChevronDown} color={theme.colors.textMuted} />
        </View>
        {expanded ? (
          <AppText tone="secondary" testID={`faq-${item.id}-answer`}>
            {item.answer}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

function ContactSupport() {
  const toast = useToast();
  const { email, phone } = appConfig.support;

  const open = async (url: string, fallback: string) => {
    if (!(await openExternal(url))) toast.show({ type: 'error', title: fallback });
  };

  return (
    <RowSection title="Contact support">
      <FormAlert
        tone="info"
        message="Never share your password, transaction PIN or one-time codes with anyone, including someone who says they're from support."
      />
      {email ? (
        <NavRow
          icon={Mail}
          title="Email support"
          detail={email}
          onPress={() =>
            void open(
              supportMailto(email, 'PALPEER support request'),
              `No email app found. Write to ${email}.`,
            )
          }
          testID="support-email"
        />
      ) : null}
      {phone ? (
        <NavRow
          icon={Phone}
          title="Call support"
          detail={phone}
          onPress={() => void open(telUrl(phone), `Calling isn't available. Call ${phone}.`)}
          testID="support-phone"
        />
      ) : null}
      {!email && !phone ? (
        <AppText tone="secondary" testID="support-unavailable">
          Support contact details aren&apos;t available in this version of the app yet.
        </AppText>
      ) : null}
    </RowSection>
  );
}
