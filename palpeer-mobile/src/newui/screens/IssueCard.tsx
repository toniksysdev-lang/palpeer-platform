import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Choice, Field, Flag, H1, Loading, Overlay, P, Screen, TopBar, Txt } from '@/newui/ui/kit';

export type IssueCurrencyOption = {
  code: string;
  symbol: string;
  name: string;
  cc: string;
  hasWallet: boolean;
};

type Props = {
  backend?: boolean;
  loading?: boolean;
  loadError?: string | null;
  cardsEnabled?: boolean;
  currencies?: IssueCurrencyOption[];
  busy?: boolean;
  error?: string | null;
  onIssue?: (input: {
    currencyCode: string;
    linkWallet: boolean;
    cardholderName: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRetry?: () => void;
  onBack?: () => void;
};

/** Issue a virtual card — newui. */
export default function IssueCard(props: Props) {
  const c = useC();
  const currencies = props.currencies ?? [];
  const [currency, setCurrency] = useState<string | null>(null);
  const [linkWallet, setLinkWallet] = useState(false);
  const [holder, setHolder] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const back = () => {
    if (props.onBack) props.onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/More' as Href);
  };

  const selected = currencies.find((x) => x.code === currency) ?? null;
  const err = localError || props.error;

  if (props.loading) {
    return (
      <Screen>
        <TopBar onBack={back} />
        <Loading title="Loading currencies" />
      </Screen>
    );
  }

  if (props.loadError) {
    return (
      <Screen gap={12}>
        <TopBar onBack={back} />
        <H1>Issue a card</H1>
        <Txt size={17} color="red" noTr>
          {props.loadError}
        </Txt>
        <Btn size="mid" label="Try again" onPress={() => props.onRetry?.()} />
      </Screen>
    );
  }

  if (props.cardsEnabled === false) {
    return (
      <Screen gap={12}>
        <TopBar onBack={back} />
        <H1>Issue a card</H1>
        <P>Virtual cards are not available yet.</P>
        <Btn size="mid" label="Back" onPress={back} />
      </Screen>
    );
  }

  const issue = async () => {
    if (!currency || !props.onIssue) return;
    setLocalError(null);
    const r = await props.onIssue({
      currencyCode: currency,
      linkWallet,
      cardholderName: holder.trim(),
    });
    setConfirming(false);
    if (!r.ok) setLocalError(r.error || 'Could not issue card.');
  };

  return (
    <Screen scroll gap={12}>
      <TopBar onBack={back} say="Issue a card. Choose the card currency." />
      <H1>Issue a card</H1>
      <P>Choose the card currency.</P>
      {err ? (
        <Txt size={16} w="700" color="red" role="alert" noTr>
          {err}
        </Txt>
      ) : null}
      {currencies.map((item) => (
        <Choice
          key={item.code}
          title={item.name}
          note={`${item.code} · ${item.symbol}`}
          icon={<Flag cc={item.cc} w={48} />}
          on={item.code === currency}
          onPress={() => {
            setCurrency(item.code);
            setLinkWallet(false);
            setLocalError(null);
          }}
          right={null}
          minH={72}
        />
      ))}
      {selected?.hasWallet ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: linkWallet }}
          onPress={() => setLinkWallet(!linkWallet)}
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            borderRadius: 18,
            backgroundColor: c.card,
            padding: 14,
            borderWidth: 3,
            borderColor: linkWallet ? c.brandText : 'transparent',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              borderWidth: 3,
              borderColor: c.text,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: linkWallet ? c.brand : 'transparent',
            }}
          >
            {linkWallet ? (
              <Txt size={18} w="800" color="#FFFFFF" noTr>
                ✓
              </Txt>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={17} w="700">
              Link to my {selected.code} wallet
            </Txt>
            <Txt size={15} color="text2">
              Optional. Only a wallet in the same currency can be linked.
            </Txt>
          </View>
        </Pressable>
      ) : null}
      <Card>
        <Field
          label="Name on card (optional)"
          value={holder}
          onChangeText={setHolder}
          autoCapitalize="words"
          maxLength={120}
        />
      </Card>
      <View style={{ flex: 1 }} />
      <Btn
        label={currency ? `Issue ${currency} card` : 'Choose a currency'}
        disabled={!currency || !!props.busy}
        busy={!!props.busy}
        onPress={() => setConfirming(true)}
      />

      <Overlay open={confirming}>
        <Screen gap={12}>
          <H1>Issue this card?</H1>
          <P noTr>
            {currency
              ? `A virtual ${currency} card will be issued${
                  linkWallet && selected?.hasWallet ? ` and linked to your ${currency} wallet` : ''
                }.`
              : ''}
          </P>
          <Btn
            label="Issue card"
            busy={!!props.busy}
            onPress={() => void issue()}
          />
          <Btn kind="outline" size="mid" label="Cancel" onPress={() => setConfirming(false)} />
        </Screen>
      </Overlay>
    </Screen>
  );
}
