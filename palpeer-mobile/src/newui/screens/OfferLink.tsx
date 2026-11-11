import { router, type Href } from 'expo-router';
import { Image, View } from 'react-native';
import type { useLiveOfferLink } from '@/design/bridge/useLiveOfferLink';
import { useC } from '@/newui/lib/theme';
import { Icon } from '@/newui/ui/Icon';
import { Btn, Card, Flag, H1, H2, P, Row, Screen, Txt } from '@/newui/ui/kit';

type OfferLinkProps = ReturnType<typeof useLiveOfferLink> & {
  go?: (href: string) => void;
};

/** Shared offer deep link — guest view wired to useLiveOfferLink. */
export default function OfferLink(props: OfferLinkProps) {
  const c = useC();
  const headline = props.headline ?? (props.ready ? 'A person shared an offer' : 'Someone shared an offer with you');
  const totalLabel = props.totalLabel ?? '—';
  const rateLabel = props.rateLabel ?? '—';
  const loginHref = props.requestId ? `/StartLogin?buying=1&requestId=${props.requestId}` : '/StartLogin?buying=1';

  return (
    <Screen>
      <Image
        source={require('@/newui/assets/logo.png')}
        style={{ width: 160, height: 68, alignSelf: 'center' }}
        resizeMode="contain"
        accessibilityLabel="Palpeer"
      />
      <H1 center>{headline}</H1>
      <Card style={{ alignItems: 'center' }}>
        <Row gap={12}>
          <Flag cc="CA" w={60} />
          <Icon name="arrow" size={28} color={c.brandText} />
          <Flag cc="NG" w={60} />
        </Row>
        <Txt size={28} w="800" noTr>
          {totalLabel}
        </Txt>
        <Txt size={18} w="700" color="text2" noTr>
          {rateLabel}
        </Txt>
      </Card>
      <View style={{ flex: 1 }} />
      <H2>Do you have Palpeer?</H2>
      <Btn label="Yes, log in" onPress={() => router.replace(loginHref as Href)} />
      <Btn kind="outline" size="mid" label="No, get the app" onPress={() => router.replace('/')} />
      <P center>After you log in or join, this offer opens for you.</P>
    </Screen>
  );
}
