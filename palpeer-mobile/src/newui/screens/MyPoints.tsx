import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Divider, H1, Loading, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Entry = {
  pointsLabel: string;
  statusLabel: string;
  tone: string;
  note: string;
  cadLabel: string;
};

type Props = {
  backend?: boolean;
  balancePoints?: number;
  balanceCadText?: string;
  earnedPoints?: number;
  usedPoints?: number;
  pointsPerCad?: number;
  entries?: Entry[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onInvite?: () => void;
  onLoadMore?: () => void;
};

/** My points — live loyalty balance + ledger. */
export default function MyPoints(props: Props) {
  const c = useC();
  const pts = props.balancePoints ?? 0;
  const cad = props.balanceCadText || 'CA$0.00';
  const per = props.pointsPerCad ?? 100;
  const entries = props.entries ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/More' as Href));

  return (
    <Screen scroll gap={10}>
      <TopBar
        onBack={back}
        say={`You have ${pts} points. That is ${cad} off your P2P fees.`}
      />
      <H1>My points</H1>
      <Card gap={2} bg="#5E3AB8">
        <Txt size={16} w="700" color="#FFFFFF">
          You have
        </Txt>
        <Txt size={38} w="800" color="#FFFFFF" noTr>
          {`${pts} points`}
        </Txt>
        <Txt size={17} w="700" color="#FFFFFF" noTr>
          {`= ${cad} off your P2P fees`}
        </Txt>
      </Card>
      <P noTr>{`You earn ${per} points when a friend joins with your code and passes the ID check. ${per} points = CA$1. Points end on the date Palpeer shows.`}</P>
      <Row gap={10}>
        <Card style={{ flex: 1 }} gap={2}>
          <Txt size={28} w="800" noTr>
            {String(props.earnedPoints ?? 0)}
          </Txt>
          <Txt size={15} color="text2">
            earned
          </Txt>
        </Card>
        <Card style={{ flex: 1 }} gap={2}>
          <Txt size={28} w="800" noTr>
            {String(props.usedPoints ?? 0)}
          </Txt>
          <Txt size={15} color="text2">
            used
          </Txt>
        </Card>
      </Row>
      <Txt size={18} w="800">
        How you got and used them
      </Txt>
      {entries.length === 0 ? (
        <Card>
          <Txt size={17} color="text2">
            No points history yet.
          </Txt>
        </Card>
      ) : (
        <Card gap={6}>
          {entries.map((e, i) => (
            <View key={`${e.note}-${i}`} style={{ gap: 6 }}>
              {i ? <Divider /> : null}
              <Row between>
                <View style={{ flex: 1 }}>
                  <Txt size={17} w="700" noTr>
                    {e.statusLabel}
                  </Txt>
                  <Txt size={14} color="text3" noTr>
                    {e.note}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt size={18} w="800" color={e.tone === 'earned' ? 'brandText' : 'red'} noTr>
                    {e.pointsLabel}
                  </Txt>
                  <Txt size={13} color="text3" noTr>
                    {e.cadLabel}
                  </Txt>
                </View>
              </Row>
            </View>
          ))}
        </Card>
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
      <Btn
        size="mid"
        label="Invite friends to earn more"
        onPress={() => (props.onInvite ? props.onInvite() : router.push('/InviteFriends' as Href))}
      />
    </Screen>
  );
}
