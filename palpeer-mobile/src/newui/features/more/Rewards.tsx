import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Divider, H1, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';
import { INV_CODE, INV_MSG, INVITED, POINTS_LOG, PROMOS } from '../moreData';

/** My points: 300 points = CA$3.00, switch to use them on the next P2P fee, history. */
export function Points({ onBack, onInvite, usePoints, setUsePoints }: { onBack: () => void; onInvite: () => void; usePoints: boolean; setUsePoints: (v: boolean) => void }) {
  const c = useC();
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say={'You have 300 points. That is 3 Canada dollars off your P2P fees. Using points on your next fee is ' + (usePoints ? 'on.' : 'off.')} />
      <H1>My points</H1>
      <Card gap={2} bg="#5E3AB8">
        <Txt size={16} w="700" color="#FFFFFF">
          You have
        </Txt>
        <Txt size={38} w="800" color="#FFFFFF">
          300 points
        </Txt>
        <Txt size={17} w="700" color="#FFFFFF">
          = CA$3.00 off your P2P fees
        </Txt>
      </Card>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: usePoints }} onPress={() => setUsePoints(!usePoints)} style={{ borderRadius: 18, backgroundColor: c.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 3, borderColor: usePoints ? c.brandText : 'transparent' }}>
        <View style={{ flex: 1 }}>
          <Txt size={18} w="800">
            Use your points on your next P2P fee
          </Txt>
          <Txt size={15} color="text2">
            They can pay the whole fee.
          </Txt>
        </View>
        <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: usePoints ? '#0B6E4F' : '#46574F' }}>
          <Txt size={16} w="800" color="#FFFFFF">
            {usePoints ? 'On' : 'Off'}
          </Txt>
        </View>
      </Pressable>
      <P>You earn 100 points when a friend joins with your code and passes the ID check. 100 points = CA$1. Points end on the date Palpeer shows.</P>
      <Txt size={18} w="800">
        How you got and used them
      </Txt>
      <Card gap={6}>
        {POINTS_LOG.map(([a, b, d], i) => (
          <View key={i} style={{ gap: 6 }}>
            {i ? <Divider /> : null}
            <Row between>
              <View style={{ flex: 1 }}>
                <Txt size={17} w="700">
                  {a}
                </Txt>
                <Txt size={14} color="text3">
                  {d}
                </Txt>
              </View>
              <Txt size={18} w="800" color={b[0] === '+' ? 'brandText' : 'red'} noTr>
                {b}
              </Txt>
            </Row>
          </View>
        ))}
      </Card>
      <Btn size="mid" label="Invite friends to earn more" onPress={onInvite} />
    </Screen>
  );
}

/** My bonuses: what I have and what I used. */
export function Bonuses({ onBack, usePoints, usedPromos }: { onBack: () => void; usePoints: boolean; usedPromos: string[] }) {
  const c = useC();
  const [tab, setTab] = useState<'have' | 'used'>('have');
  const list =
    tab === 'have'
      ? [
          { title: '300 points', tag: 'CA$3.00', note: 'Use them on your next P2P fee. ' + (usePoints ? 'Turned on.' : 'Turned off.'), color: '#5E3AB8' },
          { title: 'Friend code: 50% off', tag: 'Once', note: 'Half off your own P2P fee, one time. Ends Dec 31.', color: '#0B6E4F' },
          ...usedPromos.map((id) => {
            const p = PROMOS.find((x) => x.id === id)!;
            return { title: p.title, tag: 'Ready', note: p.text + ' ' + p.ends + '.', color: '#0B6E4F' };
          }),
        ]
      : [
          { title: 'Code SPRING50', tag: 'Saved CA$1.00', note: '50% off your P2P fee. Used Oct 20.', color: '#46574F' },
          { title: '200 points', tag: 'Saved CA$2.00', note: 'Paid your whole P2P fee. Used Oct 28.', color: '#46574F' },
        ];
  const tabBtn = (key: 'have' | 'used', label: string) => (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: tab === key ? c.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={16} w="800" color={tab === key ? '#FFFFFF' : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say={tab === 'have' ? 'You have 300 points and a friend code for 50 percent off.' : 'You used a code and 200 points.'} />
      <H1>My bonuses</H1>
      <Row gap={4} style={{ backgroundColor: c.card, borderRadius: 14, padding: 4 }}>
        {tabBtn('have', 'You have')}
        {tabBtn('used', 'You used')}
      </Row>
      {list.map((x, i) => (
        <Card key={i} gap={4} style={{ borderLeftWidth: 6, borderLeftColor: x.color }}>
          <Row between>
            <Txt size={18} w="800" style={{ flex: 1 }}>
              {x.title}
            </Txt>
            <Txt size={15} w="800" color={x.color}>
              {x.tag}
            </Txt>
          </Row>
          <Txt size={15} color="text2">
            {x.note}
          </Txt>
        </Card>
      ))}
      <P>Bonuses are used on Choose a person, when you buy or post an offer.</P>
    </Screen>
  );
}

/** Promotions: use a code (adds it to bonuses) or go invite friends. */
export function Promos({ onBack, usedPromos, setUsedPromos, onInvite }: { onBack: () => void; usedPromos: string[]; setUsedPromos: (v: string[]) => void; onInvite: () => void }) {
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say="Promotions. Weekend half off your P2P fee. And invite 3 friends this month for 100 extra points." />
      <H1>Promotions</H1>
      <P>Offers you can use now. One use per person.</P>
      {PROMOS.map((p) => {
        const got = usedPromos.includes(p.id);
        return (
          <Card key={p.id} gap={6}>
            <Txt size={19} w="800">
              {p.title}
            </Txt>
            <Txt size={16} color="text2">
              {p.text}
            </Txt>
            {p.code ? (
              <Txt size={16} w="700" noTr>
                {'Code: ' + p.code}
              </Txt>
            ) : null}
            <Txt size={15} w="700" color="orange">
              {p.ends}
            </Txt>
            <Btn size="small" label={p.code ? (got ? 'Added to your bonuses' : 'Use this') : 'Invite friends'} disabled={got} onPress={p.code ? () => setUsedPromos([...usedPromos, p.id]) : onInvite} />
          </Card>
        );
      })}
    </Screen>
  );
}

/** My invite code: copy, share, see who joined. */
export function InviteCode({ onBack, onInvited }: { onBack: () => void; onInvited: () => void }) {
  const c = useC();
  const [copied, setCopied] = useState('');
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say="Your invite code is O L U W A 2 6. Share it with a friend." />
      <H1>My invite code</H1>
      <Card style={{ alignItems: 'center' }}>
        <Txt size={16} color="text2">
          My code
        </Txt>
        <Txt size={38} w="800" noTr style={{ letterSpacing: 4 }}>
          {INV_CODE}
        </Txt>
        <Btn
          size="small"
          kind="outline"
          label={copied === 'code' ? 'Copied' : 'Copy code'}
          onPress={() => {
            Clipboard.setStringAsync(INV_CODE).catch(() => {});
            setCopied('code');
          }}
        />
      </Card>
      <P>When a friend joins with your code and passes the ID check, you get 100 points. Your friend gets 50% off their first P2P fee.</P>
      <Card gap={4} bg={c.field}>
        <Txt size={15} w="700" color="text2">
          The message your friend gets
        </Txt>
        {/* The invite message is in the sender's own words, so it stays as written. */}
        <Txt size={16} w="600" noTr>
          {INV_MSG}
        </Txt>
      </Card>
      {copied === 'msg' ? (
        <Txt size={16} w="700" color="brandText" role="alert">
          Ready to share. Pick an app to send it.
        </Txt>
      ) : null}
      <Btn
        label="Share with a friend"
        icon="share"
        onPress={() => {
          Share.share({ title: 'Palpeer', message: INV_MSG }).catch(() => {});
          setCopied('msg');
        }}
      />
      <Btn kind="outline" size="mid" label="See who joined" onPress={onInvited} />
    </Screen>
  );
}

/** People I invited: 5 joined, 500 points. */
export function Invited({ onBack, onInvite }: { onBack: () => void; onInvite: () => void }) {
  return (
    <Screen scroll gap={10}>
      <TopBar onBack={onBack} say="5 friends joined and passed the ID check. You got 500 points from them." />
      <H1>People you invited</H1>
      <Row gap={10}>
        <Card style={{ flex: 1 }} gap={2}>
          <Txt size={32} w="800" noTr>
            5
          </Txt>
          <Txt size={15} color="text2">
            joined and checked
          </Txt>
        </Card>
        <Card style={{ flex: 1 }} gap={2}>
          <Txt size={32} w="800" noTr>
            500
          </Txt>
          <Txt size={15} color="text2">
            points from them
          </Txt>
        </Card>
      </Row>
      <Card gap={6}>
        {INVITED.map((v, i) => (
          <View key={v.name} style={{ gap: 6 }}>
            {i ? <Divider /> : null}
            <Row between>
              <View style={{ flex: 1 }}>
                <Txt size={17} w="800" noTr>
                  {v.name}
                </Txt>
                <Txt size={15} w="600" color={v.ok ? 'brandText' : 'orange'}>
                  {v.state}
                </Txt>
              </View>
              <Txt size={15} w="800" color="text2">
                {v.pts}
              </Txt>
            </Row>
          </View>
        ))}
      </Card>
      <Btn size="mid" label="Invite more friends" onPress={onInvite} />
    </Screen>
  );
}
