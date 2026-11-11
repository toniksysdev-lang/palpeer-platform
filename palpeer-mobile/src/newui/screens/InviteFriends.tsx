import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Divider, H1, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Person = { title: string; note: string };

type Props = {
  backend?: boolean;
  tab?: 'code' | 'people';
  referralCode?: string;
  shareMessage?: string;
  joinedText?: string;
  people?: Person[];
  onShare?: () => void | Promise<void>;
  onCopy?: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** Invite friends — code share + who joined. */
export default function InviteFriends(props: Props) {
  const c = useC();
  const [tab, setTab] = useState<'code' | 'people'>(props.tab === 'people' ? 'people' : 'code');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const code = props.referralCode || '';
  const people = props.people ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/More' as Href));

  useEffect(() => {
    if (props.tab === 'people' || props.tab === 'code') setTab(props.tab);
  }, [props.tab]);

  const tabBtn = (key: 'code' | 'people', label: string) => (
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
      <TopBar
        onBack={back}
        say={
          tab === 'code'
            ? `Your invite code is ${code.split('').join(' ') || 'not ready yet'}. Share it with a friend.`
            : props.joinedText || 'People you invited.'
        }
      />
      <H1>{tab === 'code' ? 'My invite code' : 'People you invited'}</H1>
      <Row gap={4} style={{ backgroundColor: c.card, borderRadius: 14, padding: 4 }}>
        {tabBtn('code', 'My code')}
        {tabBtn('people', 'Who joined')}
      </Row>

      {tab === 'code' ? (
        <>
          <Card style={{ alignItems: 'center' }} gap={8}>
            <Txt size={16} color="text2">
              My code
            </Txt>
            <Txt size={38} w="800" noTr style={{ letterSpacing: 4 }}>
              {code || '····'}
            </Txt>
            <Btn
              size="small"
              kind="outline"
              label={copied ? 'Copied' : 'Copy code'}
              disabled={!code}
              onPress={async () => {
                setCopyError(null);
                const r = await props.onCopy?.();
                if (r && !r.ok) {
                  setCopyError(r.error);
                  return;
                }
                setCopied(true);
              }}
            />
            {copyError ? (
              <Txt size={15} w="700" color="red" noTr>
                {copyError}
              </Txt>
            ) : null}
          </Card>
          <P>When a friend joins with your code and passes the ID check, you get 100 points. Your friend gets 50% off their first P2P fee.</P>
          {props.shareMessage ? (
            <Card gap={4} bg={c.field}>
              <Txt size={15} w="700" color="text2">
                The message your friend gets
              </Txt>
              <Txt size={16} w="600" noTr>
                {props.shareMessage}
              </Txt>
            </Card>
          ) : null}
          <Btn label="Share with a friend" icon="share" disabled={!code} onPress={() => void props.onShare?.()} />
          <Btn kind="outline" size="mid" label="See who joined" onPress={() => setTab('people')} />
        </>
      ) : (
        <>
          <Card gap={4}>
            <Txt size={17} w="700" noTr>
              {props.joinedText || 'Nobody has joined yet'}
            </Txt>
          </Card>
          {people.length === 0 ? (
            <Card>
              <Txt size={17} color="text2">
                Invite a friend with your code to see them here.
              </Txt>
            </Card>
          ) : (
            <Card gap={6}>
              {people.map((v, i) => (
                <View key={`${v.title}-${i}`} style={{ gap: 6 }}>
                  {i ? <Divider /> : null}
                  <View>
                    <Txt size={17} w="800" noTr>
                      {v.title}
                    </Txt>
                    <Txt size={15} w="600" color="text2" noTr>
                      {v.note}
                    </Txt>
                  </View>
                </View>
              ))}
            </Card>
          )}
          <Btn size="mid" label="Invite more friends" onPress={() => setTab('code')} />
        </>
      )}
    </Screen>
  );
}
