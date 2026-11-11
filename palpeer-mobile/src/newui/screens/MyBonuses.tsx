import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Card, H1, Loading, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type SummaryRow = { currencyCode: string; totalText: string; unusedText: string; usedText: string };
type Item = { unused: boolean; used: boolean; amountText: string; note: string; statusLabel: string };

type Props = {
  backend?: boolean;
  summary?: SummaryRow[];
  items?: Item[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

/** My bonuses — live bonus summary + list. */
export default function MyBonuses(props: Props) {
  const c = useC();
  const [tab, setTab] = useState<'have' | 'used'>('have');
  const items = props.items ?? [];
  const list = useMemo(
    () => items.filter((x) => (tab === 'have' ? x.unused : x.used)),
    [items, tab],
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/More' as Href));

  const tabBtn = (key: 'have' | 'used', label: string) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === key }}
      onPress={() => setTab(key)}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: tab === key ? c.brand : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt size={16} w="800" color={tab === key ? '#FFFFFF' : c.text}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Screen scroll gap={10}>
      <TopBar onBack={back} say={tab === 'have' ? 'Bonuses you have.' : 'Bonuses you used.'} />
      <H1>My bonuses</H1>
      {(props.summary ?? []).map((s) => (
        <Card key={s.currencyCode} gap={4}>
          <Txt size={16} w="700" color="text2" noTr>
            {s.currencyCode}
          </Txt>
          <Row between>
            <Txt size={15} color="text2">
              Unused
            </Txt>
            <Txt size={17} w="800" noTr>
              {s.unusedText}
            </Txt>
          </Row>
          <Row between>
            <Txt size={15} color="text2">
              Used
            </Txt>
            <Txt size={17} w="800" noTr>
              {s.usedText}
            </Txt>
          </Row>
        </Card>
      ))}
      <Row gap={4} style={{ backgroundColor: c.card, borderRadius: 14, padding: 4 }}>
        {tabBtn('have', 'You have')}
        {tabBtn('used', 'You used')}
      </Row>
      {list.length === 0 ? (
        <Card>
          <Txt size={17} color="text2">
            {tab === 'have' ? 'No unused bonuses right now.' : 'No used bonuses yet.'}
          </Txt>
        </Card>
      ) : (
        list.map((x, i) => (
          <Card key={`${x.note}-${i}`} gap={4} style={{ borderLeftWidth: 6, borderLeftColor: x.unused ? '#0B6E4F' : '#46574F' }}>
            <Row between>
              <Txt size={18} w="800" style={{ flex: 1 }} noTr>
                {x.amountText}
              </Txt>
              <Txt size={15} w="800" color={x.unused ? 'brandText' : 'text2'} noTr>
                {x.statusLabel}
              </Txt>
            </Row>
            <Txt size={15} color="text2" noTr>
              {x.note}
            </Txt>
          </Card>
        ))
      )}
      {props.hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={props.loadingMore}
          onPress={() => props.onLoadMore?.()}
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          {props.loadingMore ? (
            <Loading title="Loading more" />
          ) : (
            <Txt size={16} w="700" color="brandText">
              Load more
            </Txt>
          )}
        </Pressable>
      ) : null}
      <P>Bonuses are used on Choose a person, when you buy or post an offer.</P>
    </Screen>
  );
}
