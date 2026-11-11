import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, RefreshControl, ScrollView, View, type View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HistoryListItem } from '@/design/bridge/useLiveHistory';
import { DateOfBirthField } from '@/features/profile/DateOfBirthField';
import { toDisplayDate, toIsoDate } from '@/features/profile/schemas';
import { useListen } from '@/newui/lib/speech';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from '@/newui/ui/BottomNav';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Choice, Divider, H1, H2, Line, Loading, Overlay, Pill, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type FilterOption = { key: string; title: string; note: string; selected: boolean; pick: () => void };

type HistoryProps = {
  backend?: boolean;
  groups?: { key: string; label: string; items: HistoryListItem[] }[];
  liveItems?: HistoryListItem[];
  stats?: {
    periodTitle: string;
    totalText: string;
    countsText: string;
    moneyIn: string;
    moneyOut: string;
    footer: string;
  };
  typeTitle?: string;
  periodTitle?: string;
  typeOptions?: FilterOption[];
  periodOptions?: FilterOption[];
  filtering?: boolean;
  clearFilters?: () => void;
  applyCustomRange?: (fromIsoDay: string, toIsoDay: string) => { ok: true } | { ok: false; error: string };
  detailOpen?: boolean;
  detail?: HistoryListItem | null;
  detailLoading?: boolean;
  onOpenDetail?: (type: HistoryListItem['type'], id: string) => void;
  onCloseDetail?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  historyLoading?: boolean;
  empty?: boolean;
  onSaveImage?: (ref: RefObject<RNView | null>) => void;
  onSavePdf?: (ref: RefObject<RNView | null>) => void;
  savingFormat?: 'image' | 'pdf' | null;
  canSave?: boolean;
  unreadCount?: number;
  msgBadge?: string;
  onRefresh?: () => void;
};

function todayIsoDay(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseBound(display: string): Date | undefined {
  const iso = toIsoDate(display);
  if (!iso) return undefined;
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, day!);
}

const STATUS_COLOR: Record<string, string> = {
  'Held for review': 'orange',
  Closed: 'text3',
  Done: 'brandText',
  Waiting: 'orange',
  'Not done': 'red',
  'Money returned': 'blue',
};

const DETAIL_STATUS_HEX: Record<string, string> = {
  Done: '#0B6E4F',
  Waiting: '#A84C08',
  'Not done': '#B3231A',
  'Money returned': '#1D5BC7',
  Closed: '#46574F',
  'Held for review': '#A84C08',
};

/** History: filters, grouped feed, receipt detail — wired to useLiveHistory. */
export default function History(props: HistoryProps) {
  const c = useC();
  const { listen, listenLabel } = useListen();
  const [picker, setPicker] = useState<'type' | 'period' | 'customRange' | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const receiptRef = useRef<RNView>(null);

  const groups = props.groups ?? [];
  const flat = props.liveItems ?? [];
  const stats = props.stats;
  const detail = props.detail;
  const status = detail?.status || 'Done';
  const today = useMemo(() => new Date(), []);
  const todayDisplay = useMemo(() => toDisplayDate(todayIsoDay()), []);

  const sayList = useMemo(
    () => 'History. ' + flat.map((t) => t.title + ', ' + t.line + ', at ' + t.time).join('. ') + '.',
    [flat],
  );

  const sayDetail = useMemo(() => {
    if (!detail) return sayList;
    return (
      detail.title +
      '. ' +
      detail.rows.map((r) => r[0] + ' ' + r[1]).join('. ') +
      '. ' +
      status +
      '.'
    );
  }, [detail, sayList, status]);

  const closePicker = useCallback(() => {
    setPicker(null);
    setRangeError(null);
  }, []);

  const openCustomRange = useCallback(() => {
    setRangeFrom(todayDisplay);
    setRangeTo(todayDisplay);
    setRangeError(null);
    setPicker('customRange');
  }, [todayDisplay]);

  const applyRange = useCallback(() => {
    const fromIso = toIsoDate(rangeFrom);
    const toIso = toIsoDate(rangeTo);
    if (!fromIso || !toIso) {
      setRangeError('Pick valid From and To dates.');
      return;
    }
    const result = props.applyCustomRange?.(fromIso, toIso);
    if (!result) {
      setRangeError('Could not apply dates.');
      return;
    }
    if (!result.ok) {
      setRangeError(result.error);
      return;
    }
    setRangeError(null);
    setPicker(null);
  }, [props, rangeFrom, rangeTo]);

  const pickerTitle =
    picker === 'type' ? 'Type' : picker === 'period' ? 'Period' : picker === 'customRange' ? 'From / To' : '';
  const pickerOptions =
    picker === 'type' ? props.typeOptions ?? [] : picker === 'period' ? props.periodOptions ?? [] : [];

  const fromBound = parseBound(rangeFrom);
  const toBound = parseBound(rangeTo);

  const saving = props.savingFormat;
  const saveBusy = !!saving;

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
          <H1>History</H1>
          <Pill icon="listen" dark label={listenLabel} a11y="Listen to this screen" onPress={() => listen(props.detailOpen ? sayDetail : sayList)} />
        </Row>

        <Row gap={8}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicker('type')}
            style={{ flex: 1, minHeight: 64, borderRadius: 16, backgroundColor: c.card, padding: 12, justifyContent: 'center', gap: 2 }}
          >
            <Txt size={13} w="700" color="text3" style={{ textTransform: 'uppercase' }}>
              Type
            </Txt>
            <Txt size={17} w="800">
              {props.typeTitle ?? 'All types'}
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPicker('period')}
            style={{ flex: 1, minHeight: 64, borderRadius: 16, backgroundColor: c.card, padding: 12, justifyContent: 'center', gap: 2 }}
          >
            <Txt size={13} w="700" color="text3" style={{ textTransform: 'uppercase' }}>
              Period
            </Txt>
            <Txt size={17} w="800">
              {props.periodTitle ?? 'All time'}
            </Txt>
          </Pressable>
        </Row>

        {stats ? (
          <Card gap={10}>
            <Txt size={13} w="700" color="text3" style={{ textTransform: 'uppercase' }}>
              {stats.periodTitle}
            </Txt>
            <Txt size={26} w="800" lh={1.15}>
              {stats.totalText}
            </Txt>
            {stats.countsText ? (
              <Txt size={14} w="600" color="text2" lh={1.35}>
                {stats.countsText}
              </Txt>
            ) : null}
            <Row gap={10}>
              <View style={{ flex: 1, padding: 10, borderRadius: 14, backgroundColor: c.tileGreen, gap: 4 }}>
                <Txt size={13} w="700" color="brandText">
                  Money in
                </Txt>
                <Txt size={16} w="800">
                  {stats.moneyIn}
                </Txt>
              </View>
              <View style={{ flex: 1, padding: 10, borderRadius: 14, backgroundColor: c.tilePurple, gap: 4 }}>
                <Txt size={13} w="700" style={{ color: '#5E3AB8' }}>
                  Money out
                </Txt>
                <Txt size={16} w="800">
                  {stats.moneyOut}
                </Txt>
              </View>
            </Row>
            {stats.footer ? (
              <Txt size={14} w="600" color="text2">
                {stats.footer}
              </Txt>
            ) : null}
          </Card>
        ) : null}

        {props.filtering ? (
          <Btn kind="soft" size="mid" label="Clear filters" onPress={() => props.clearFilters?.()} />
        ) : null}

        {props.historyLoading && props.empty ? (
          <Txt size={17} w="600" color="text2" style={{ textAlign: 'center', paddingTop: 24 }}>
            Loading history…
          </Txt>
        ) : null}

        {props.empty && !props.historyLoading ? (
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
            <Txt size={22} w="800">
              {props.filtering ? 'No matches' : 'No activity yet'}
            </Txt>
            <Txt size={16} w="600" color="text2" style={{ textAlign: 'center' }}>
              {props.filtering ? 'Nothing matches these filters.' : 'Funding, withdrawals and exchanges will show here.'}
            </Txt>
          </View>
        ) : null}

        {groups.map((g) => (
          <View key={g.key} style={{ gap: 10 }}>
            <H2>{g.label}</H2>
            {g.items.map((t) => (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                onPress={() => props.onOpenDetail?.(t.type, t.id)}
                style={{ minHeight: 76, borderRadius: 18, backgroundColor: c.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={t.icon} size={28} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={18} w="800">
                    {t.title}
                  </Txt>
                  <Txt size={17} w="700">
                    {t.line}
                  </Txt>
                  <Txt size={15} w="700" color={STATUS_COLOR[t.status] ?? 'text3'}>
                    {t.time + '. ' + t.status}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {props.hasMore ? (
          <Btn
            kind="soft"
            size="mid"
            label={props.loadingMore ? 'Loading…' : 'Load more'}
            disabled={props.loadingMore}
            onPress={() => props.onLoadMore?.()}
          />
        ) : null}
      </ScrollView>
      <BottomNav active="history" unread={props.unreadCount ?? 0} />

      <Overlay open={!!picker}>
        <Screen scroll gap={10}>
          <TopBar
            onBack={picker === 'customRange' ? () => setPicker('period') : closePicker}
            say={pickerTitle}
          />
          <H1>{pickerTitle}</H1>
          {picker === 'customRange' ? (
            <Card gap={12}>
              <Txt size={16} w="600" color="text2">
                Choose a start and end date. Both days are included.
              </Txt>
              <DateOfBirthField
                label="From"
                value={rangeFrom}
                onChange={(display) => {
                  setRangeFrom(display);
                  setRangeError(null);
                }}
                defaultPickerDate={today}
                maximumDate={toBound && toBound.getTime() < today.getTime() ? toBound : today}
                error={null}
                testID="history-period-from"
              />
              <DateOfBirthField
                label="To"
                value={rangeTo}
                onChange={(display) => {
                  setRangeTo(display);
                  setRangeError(null);
                }}
                defaultPickerDate={today}
                minimumDate={fromBound}
                maximumDate={today}
                error={null}
                testID="history-period-to"
              />
              {rangeError ? (
                <Txt size={15} w="700" color="red">
                  {rangeError}
                </Txt>
              ) : null}
              <Btn size="mid" label="Apply dates" onPress={applyRange} />
            </Card>
          ) : (
            pickerOptions.map((o) => (
              <Choice
                key={o.key}
                title={o.title}
                note={o.note}
                on={o.selected}
                onPress={() => {
                  if (o.key === 'CUSTOM') {
                    openCustomRange();
                    return;
                  }
                  o.pick();
                  closePicker();
                }}
              />
            ))
          )}
        </Screen>
      </Overlay>

      <Overlay open={!!props.detailOpen}>
        {props.detailLoading ? (
          <Loading title="Loading receipt" text="Just a moment." />
        ) : detail ? (
          <Screen scroll gap={12}>
            <TopBar
              onBack={() => {
                setCopiedKey(null);
                props.onCloseDetail?.();
              }}
              say={sayDetail}
            />
            <H1>{detail.title}</H1>
            <View ref={receiptRef} collapsable={false} style={{ gap: 12 }}>
              <Card gap={4}>
                {detail.rows.map(([k, v]) => (
                  <Line key={k} k={k} v={v} />
                ))}
                <Divider />
                <Txt size={19} w="800" style={{ color: detail.color2 || DETAIL_STATUS_HEX[status] || c.brandText }}>
                  {status}
                </Txt>
                <Txt size={16} color="text2">
                  {detail.note || 'The money moved.'}
                </Txt>
                <Txt size={15} color="text3">
                  {detail.when}
                </Txt>
              </Card>
              {detail.paymentRows && detail.paymentRows.length > 0 ? (
                <Card gap={8}>
                  <Txt size={13} w="700" color="text3" style={{ textTransform: 'uppercase' }}>
                    {detail.paymentTitle || 'Payment details'}
                  </Txt>
                  {detail.paymentHint ? (
                    <Txt size={15} w="600" color="text2">
                      {detail.paymentHint}
                    </Txt>
                  ) : null}
                  {detail.paymentRows.map((row) => (
                    <Row key={row.key} between style={{ backgroundColor: c.field, borderRadius: 14, padding: 10 }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt size={13} w="700" color="text3">
                          {row.label}
                        </Txt>
                        <Txt size={17} w="800" noTr>
                          {row.value}
                        </Txt>
                      </View>
                      {row.copy ? (
                        <Btn
                          size="small"
                          kind="primary"
                          a11y={'Copy ' + row.label}
                          label={copiedKey === row.key ? 'Copied' : 'Copy'}
                          style={{
                            backgroundColor: copiedKey === row.key ? '#0B6E4F' : '#1D5BC7',
                            minWidth: 96,
                          }}
                          onPress={() => {
                            void Clipboard.setStringAsync(row.copy).catch(() => {});
                            setCopiedKey(row.key);
                          }}
                        />
                      ) : null}
                    </Row>
                  ))}
                </Card>
              ) : null}
              {detail.steps.length > 0 ? (
                <Card gap={6}>
                  <Txt size={13} w="700" color="text3" style={{ textTransform: 'uppercase' }}>
                    Progress
                  </Txt>
                  {detail.steps.map((step) => (
                    <Txt key={step} size={16} w="600" color="text2">
                      {step}
                    </Txt>
                  ))}
                </Card>
              ) : null}
            </View>
            {props.canSave ? (
              <Row gap={8}>
                <Btn
                  size="mid"
                  label={saving === 'image' ? 'Saving…' : 'Save as image'}
                  disabled={saveBusy}
                  onPress={() => props.onSaveImage?.(receiptRef)}
                  style={{ flex: 1 }}
                />
                <Btn
                  size="mid"
                  kind="outline"
                  label={saving === 'pdf' ? 'Saving…' : 'Save as PDF'}
                  disabled={saveBusy}
                  onPress={() => props.onSavePdf?.(receiptRef)}
                  style={{ flex: 1 }}
                />
              </Row>
            ) : null}
            <Btn
              kind="outline"
              size="mid"
              label="Get help with this"
              onPress={() => {
                props.onCloseDetail?.();
                router.push('/MoreHelp');
              }}
            />
          </Screen>
        ) : null}
      </Overlay>
    </SafeAreaView>
  );
}
