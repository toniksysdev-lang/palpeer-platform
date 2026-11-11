import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MoreSheetRow } from '@/design/bridge/useLiveMore';
import type { FaqSection } from '@/features/support/faq';
import { useLang } from '@/newui/lib/i18n';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from '@/newui/ui/BottomNav';
import { Icon, IconName } from '@/newui/ui/Icon';
import { Btn, Choice, Overlay, Pill, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type MoreProps = {
  sheet?: string;
  backend?: boolean;
  displayName?: string;
  identityChecked?: boolean;
  identityLabel?: string;
  emailNote?: string;
  unreadCount?: number;
  msgBadge?: string;
  sheetRows?: Record<string, MoreSheetRow[]>;
  faqSections?: readonly FaqSection[];
  supportEmail?: string;
  supportPhone?: string;
  languageLabel?: string;
  setAppLanguage?: (label: string) => void;
  appLook?: 'light' | 'dark';
  setAppLook?: (look: 'light' | 'dark') => void;
  onSignOut?: () => void | Promise<void>;
  openPinReset?: () => void;
  runSheetAction?: (action?: string) => void | Promise<void>;
  onRefresh?: () => void;
};

const MENU: { key: string; label: string; icon: IconName; color: string }[] = [
  { key: 'cards', label: 'My cards', icon: 'card', color: '#1D5BC7' },
  { key: 'safe', label: 'Stay safe', icon: 'lock', color: '#0B6E4F' },
  { key: 'invite', label: 'Invite friends', icon: 'invite', color: '#A84C08' },
  { key: 'rewards', label: 'My rewards', icon: 'gift', color: '#5E3AB8' },
  { key: 'lang', label: 'Language', icon: 'globe', color: '#0E1F19' },
  { key: 'settings', label: 'Settings', icon: 'settings', color: '#46574F' },
];

const SHEET_TITLE: Record<string, string> = {
  me: 'My details',
  help: 'Get help',
  cards: 'My cards',
  safe: 'Stay safe',
  invite: 'Invite friends',
  rewards: 'My rewards',
  settings: 'Settings',
  lang: 'Language',
  look: 'App look',
  helpFaq: 'Common questions',
  helpContact: 'Contact us',
};

const LANGS = ['English', 'French'] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** More: profile, help, settings — wired to useLiveMore. */
export default function More(props: MoreProps) {
  const c = useC();
  const { setLang } = useLang();
  const { listen, listenLabel } = useListen();
  const [sheet, setSheet] = useState<string | null>(props.sheet ?? null);
  const [faqOpen, setFaqOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (props.sheet) setSheet(props.sheet);
  }, [props.sheet]);

  const displayName = props.displayName ?? 'My account';
  const identityLabel = props.identityLabel ?? 'Identity';
  const sheetRows = props.sheetRows ?? {};

  const back = useCallback(() => {
    if (sheet === 'look') setSheet('settings');
    else if (sheet === 'helpFaq' || sheet === 'helpContact') setSheet('help');
    else setSheet(null);
  }, [sheet]);

  const go = useCallback((s: string) => {
    setSheet(s);
    setFaqOpen(null);
  }, []);

  /**
   * Navigate while the sheet still covers More, then clear the sheet afterward.
   * Closing first flashed the More root under the push animation.
   */
  const leaveSheetAndRun = useCallback(async (run: () => void | Promise<void>) => {
    setFaqOpen(null);
    await run();
    // Destination is on top by now; reset so Back lands on More root, not the sheet.
    setTimeout(() => setSheet(null), 350);
  }, []);

  const contactRows = useMemo(
    () => [
      {
        title: 'Stay safe',
        note: 'Never share your password, PIN or one-time codes with anyone, including someone who says they are from support.',
        inert: true as const,
      },
      {
        title: 'Email support',
        note: props.supportEmail ?? 'support@palpeer.com',
        action: 'supportEmail',
      },
      ...(props.supportPhone
        ? [{ title: 'Call support', note: props.supportPhone, action: 'supportPhone' as const }]
        : []),
    ],
    [props.supportEmail, props.supportPhone],
  );

  const faqSections = props.faqSections ?? [];

  const onRowPress = useCallback(
    (row: MoreSheetRow & { inert?: boolean; faqId?: string }) => {
      if (row.inert) return;
      if (row.faqId) {
        setFaqOpen((cur) => (cur === row.faqId ? null : row.faqId!));
        return;
      }
      if (row.action === 'look' || row.title === 'App look') {
        go('look');
        return;
      }
      if (row.action === 'commonQuestions' || row.title === 'Common questions') {
        if (props.runSheetAction) {
          void leaveSheetAndRun(() => props.runSheetAction?.('commonQuestions'));
        } else go('helpFaq');
        return;
      }
      if (row.action === 'contactUs' || row.title === 'Contact us') {
        go('helpContact');
        return;
      }
      if (row.action === 'supportEmail' || row.action === 'supportPhone') {
        void props.runSheetAction?.(row.action);
        return;
      }
      if (row.action) {
        void leaveSheetAndRun(() => props.runSheetAction?.(row.action));
        return;
      }
      if (row.title === 'My PIN') {
        void leaveSheetAndRun(() => {
          props.openPinReset?.();
        });
      }
    },
    [go, leaveSheetAndRun, props],
  );

  type ListRow = { title: string; note: string; on?: boolean; onPress: () => void; faqId?: string };

  const listRows: ListRow[] = useMemo(() => {
    if (sheet === 'lang') {
      const lang = props.languageLabel ?? 'English';
      return LANGS.map((l) => ({
        title: l,
        note: l === lang ? 'In use now' : 'Tap to use',
        on: l === lang,
        onPress: () => {
          props.setAppLanguage?.(l);
          setLang(l === 'French' ? 'fr' : 'en');
        },
      }));
    }
    if (sheet === 'look') {
      const look = props.appLook ?? 'light';
      return (
        [
          ['light', 'Light screen'],
          ['dark', 'Dark screen'],
        ] as const
      ).map(([id, title]) => ({
        title,
        note: look === id ? 'In use now' : 'Tap to use',
        on: look === id,
        onPress: () => props.setAppLook?.(id),
      }));
    }
    if (sheet === 'helpFaq') {
      return faqSections.flatMap((section) =>
        (section.items ?? []).map((item) => ({
          title: item.question,
          note: faqOpen === item.id ? item.answer : section.title || 'Tap to read',
          faqId: item.id,
          onPress: () => onRowPress({ title: item.question, note: item.answer, faqId: item.id }),
        })),
      );
    }
    if (sheet === 'helpContact') {
      return contactRows.map((r) => ({
        title: r.title,
        note: r.note,
        onPress: () => onRowPress(r),
      }));
    }
    if (sheet && sheetRows[sheet]) {
      return sheetRows[sheet].map((r) => ({
        title: r.title,
        note: r.note,
        onPress: () => onRowPress(r),
      }));
    }
    return [];
  }, [
    contactRows,
    faqOpen,
    faqSections,
    onRowPress,
    props,
    setLang,
    sheet,
    sheetRows,
  ]);

  const sheetTitle = sheet ? (SHEET_TITLE[sheet] ?? '') : '';
  const sheetOpen = !!sheet;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      props.onRefresh?.();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [props]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.brand} colors={[c.brand]} />
        }
      >
        <Row between style={{ minHeight: 52 }}>
          <Txt size={30} w="800" role="header">
            More
          </Txt>
          <Pill
            icon="listen"
            dark
            label={listenLabel}
            a11y="Listen to this screen"
            onPress={() =>
              listen(
                sheet
                  ? sheetTitle + '. ' + listRows.map((r) => r.title).join('. ') + '.'
                  : 'More. My details. Get help. My cards. Stay safe. Invite friends. My rewards. Language. Settings.',
              )
            }
          />
        </Row>
        <Pressable
          accessibilityRole="button"
          onPress={() => go('me')}
          style={{ borderRadius: 20, backgroundColor: c.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={22} w="800" color="#FFFFFF" noTr>
              {initials(displayName)}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={20} w="800" noTr>
              {displayName}
            </Txt>
            <Row gap={4}>
              {props.identityChecked ? <Icon name="check" size={18} color={c.brandText} /> : null}
              <Txt size={15} w="700" color="brandText">
                {identityLabel}
              </Txt>
            </Row>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => go('help')}
          style={{ minHeight: 72, borderRadius: 20, backgroundColor: c.brand, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <Icon name="chat" size={30} color="#FFFFFF" />
          <Txt size={21} w="800" color="#FFFFFF">
            Get help
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {MENU.map((m) => (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              onPress={() => go(m.key)}
              style={{ flexBasis: '47%', flexGrow: 1, minHeight: 104, borderRadius: 20, backgroundColor: c.card, padding: 14, justifyContent: 'space-between' }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={26} color="#FFFFFF" />
              </View>
              <Txt size={18} w="800">
                {m.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomNav active="more" unread={props.unreadCount ?? 0} />

      <Overlay open={sheetOpen}>
        <Screen scroll gap={10}>
          <TopBar onBack={back} say={sheetTitle + '. ' + listRows.map((r) => r.title).join('. ') + '.'} />
          <Txt size={30} w="800" role="header">
            {sheetTitle}
          </Txt>
          {listRows.map((r) => (
            <Choice
              key={r.title + r.note.slice(0, 24)}
              title={r.title}
              note={r.note}
              on={r.on}
              onPress={r.onPress}
              right={r.on === undefined ? <Icon name="next" size={24} color={c.text3} /> : undefined}
            />
          ))}
          {sheet === 'settings' ? (
            <Btn
              kind="outline"
              size="mid"
              label="Sign out"
              style={{ borderColor: c.red }}
              onPress={() => {
                setSheet(null);
                void props.onSignOut?.();
              }}
            />
          ) : null}
        </Screen>
      </Overlay>
    </SafeAreaView>
  );
}
