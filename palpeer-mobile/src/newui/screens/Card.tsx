import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useC } from '@/newui/lib/theme';
import { Btn, Card as UiCard, H1, Loading, Overlay, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type DetailRow = { label: string; value: string };
type Txn = {
  id: string;
  title: string;
  note: string;
  amountLabel: string;
  credit: boolean;
  statusLabel: string;
};

type Props = {
  backend?: boolean;
  loading?: boolean;
  error?: string | null;
  headline?: string;
  statusLabel?: string;
  faceLine?: string;
  currencyLine?: string;
  detailRows?: DetailRow[];
  testNotice?: string;
  fundingNotice?: string;
  canFreeze?: boolean;
  canUnfreeze?: boolean;
  freezeBusy?: boolean;
  unfreezeBusy?: boolean;
  transactions?: Txn[];
  txEmpty?: boolean;
  txLoading?: boolean;
  txError?: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onFreeze?: () => void | Promise<void>;
  onUnfreeze?: () => void | Promise<void>;
  onLoadMore?: () => void;
  onBack?: () => void;
  onRetry?: () => void;
};

/** Virtual card detail, freeze/unfreeze, and history. */
export default function CardScreen(props: Props) {
  const c = useC();
  const [confirm, setConfirm] = useState<'freeze' | 'unfreeze' | null>(null);
  const rows = props.detailRows ?? [];
  const txns = props.transactions ?? [];

  if (props.loading) {
    return (
      <Screen>
        <TopBar onBack={() => props.onBack?.()} />
        <Loading title="Loading your card" />
      </Screen>
    );
  }

  if (props.error) {
    return (
      <Screen gap={12}>
        <TopBar onBack={() => props.onBack?.()} />
        <H1>My card</H1>
        <Txt size={17} color="red" noTr>
          {props.error}
        </Txt>
        <Btn size="mid" label="Try again" onPress={() => props.onRetry?.()} />
      </Screen>
    );
  }

  return (
    <Screen scroll gap={12}>
      <TopBar
        onBack={() => props.onBack?.()}
        say={`${props.headline || 'My card'}. ${props.statusLabel || ''}. ${props.faceLine || ''}.`}
      />
      <H1 noTr>{props.headline || 'My card'}</H1>
      <UiCard gap={8} bg="#0B6E4F">
        <Txt size={16} w="700" color="#FFFFFF" noTr>
          {props.statusLabel || ''}
        </Txt>
        <Txt size={28} w="800" color="#FFFFFF" noTr>
          {props.faceLine || '····'}
        </Txt>
        <Txt size={16} w="600" color="#FFFFFF" noTr>
          {props.currencyLine || ''}
        </Txt>
      </UiCard>

      {props.testNotice ? (
        <UiCard>
          <Txt size={15} color="orange" noTr>
            {props.testNotice}
          </Txt>
        </UiCard>
      ) : null}

      {rows.map((r) => (
        <Row key={r.label} between style={{ minHeight: 36 }}>
          <Txt size={16} color="text2">
            {r.label}
          </Txt>
          <Txt size={17} w="800" noTr style={{ flexShrink: 1, textAlign: 'right' }}>
            {r.value}
          </Txt>
        </Row>
      ))}

      {props.fundingNotice ? (
        <P noTr>{props.fundingNotice}</P>
      ) : null}

      {props.canFreeze ? (
        <Btn
          size="mid"
          kind="outline"
          label={props.freezeBusy ? 'Freezing…' : 'Freeze card'}
          disabled={props.freezeBusy}
          onPress={() => setConfirm('freeze')}
        />
      ) : null}
      {props.canUnfreeze ? (
        <Btn
          size="mid"
          label={props.unfreezeBusy ? 'Unfreezing…' : 'Unfreeze card'}
          disabled={props.unfreezeBusy}
          onPress={() => setConfirm('unfreeze')}
        />
      ) : null}

      <Txt size={18} w="800">
        Card history
      </Txt>
      {props.txLoading && txns.length === 0 ? <Loading title="Loading history" /> : null}
      {props.txError ? (
        <Txt size={16} color="red" noTr>
          {props.txError}
        </Txt>
      ) : null}
      {props.txEmpty ? (
        <UiCard>
          <Txt size={16} color="text2">
            No card movements yet.
          </Txt>
        </UiCard>
      ) : null}
      {txns.map((t) => (
        <UiCard key={t.id} gap={4}>
          <Row between>
            <Txt size={17} w="800" style={{ flex: 1 }} noTr>
              {t.title}
            </Txt>
            <Txt size={17} w="800" color={t.credit ? 'brandText' : 'text'} noTr>
              {t.amountLabel}
            </Txt>
          </Row>
          <Txt size={14} color="text3" noTr>
            {t.note}
          </Txt>
          <Txt size={14} w="700" color="text2" noTr>
            {t.statusLabel}
          </Txt>
        </UiCard>
      ))}
      {props.hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={props.loadingMore}
          onPress={() => props.onLoadMore?.()}
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt size={16} w="700" color="brandText">
            {props.loadingMore ? 'Loading…' : 'Load more'}
          </Txt>
        </Pressable>
      ) : null}

      <Overlay open={!!confirm}>
        <Screen gap={12}>
          <H1>{confirm === 'freeze' ? 'Freeze this card?' : 'Unfreeze this card?'}</H1>
          <P>
            {confirm === 'freeze'
              ? 'Payments on this card will stop until you unfreeze it.'
              : 'You may need your PIN to turn the card back on.'}
          </P>
          <View style={{ flex: 1 }} />
          <Btn
            size="mid"
            label={confirm === 'freeze' ? 'Yes, freeze' : 'Yes, unfreeze'}
            onPress={() => {
              const action = confirm;
              setConfirm(null);
              if (action === 'freeze') void props.onFreeze?.();
              else void props.onUnfreeze?.();
            }}
          />
          <Btn size="mid" kind="outline" label="Cancel" onPress={() => setConfirm(null)} />
        </Screen>
      </Overlay>
    </Screen>
  );
}
