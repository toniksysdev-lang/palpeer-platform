import { router, type Href } from 'expo-router';
import { Btn, Card, H1, P, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Item = {
  title: string;
  code?: string | null;
  description?: string | null;
  typeLabel: string;
  windowText: string;
  isInvite: boolean;
};

type Props = {
  backend?: boolean;
  items?: Item[];
  onInvite?: () => void;
};

/** Promotions — live active promotions list. */
export default function MyPromotions(props: Props) {
  const items = props.items ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/More' as Href));
  const invite = () => (props.onInvite ? props.onInvite() : router.push('/InviteFriends' as Href));

  return (
    <Screen scroll gap={10}>
      <TopBar onBack={back} say="Promotions. Offers you can use now." />
      <H1>Promotions</H1>
      <P>Offers you can use now. One use per person.</P>
      {items.length === 0 ? (
        <Card>
          <Txt size={17} color="text2">
            No promotions right now. Check back soon.
          </Txt>
        </Card>
      ) : (
        items.map((p, i) => (
          <Card key={`${p.title}-${i}`} gap={6}>
            <Txt size={19} w="800" noTr>
              {p.title}
            </Txt>
            {p.description ? (
              <Txt size={16} color="text2" noTr>
                {p.description}
              </Txt>
            ) : null}
            <Txt size={15} w="700" color="text2" noTr>
              {p.typeLabel}
            </Txt>
            {p.code ? (
              <Txt size={16} w="700" noTr>
                {`Code: ${p.code}`}
              </Txt>
            ) : null}
            {p.windowText ? (
              <Txt size={15} w="700" color="orange" noTr>
                {p.windowText}
              </Txt>
            ) : null}
            {p.isInvite ? <Btn size="small" label="Invite friends" onPress={invite} /> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
