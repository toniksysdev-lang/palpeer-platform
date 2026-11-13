import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { View, type View as RNView } from 'react-native';
import type { HistoryListItem } from '@/design/bridge/useLiveHistory';
import { useC } from '@/newui/lib/theme';
import { Btn, Card, Divider, H1, Line, Loading, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type TransactionDetailProps = {
  backend?: boolean;
  detail?: HistoryListItem | null;
  detailLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onSaveImage?: (ref: RefObject<RNView | null>) => void;
  onSavePdf?: (ref: RefObject<RNView | null>) => void;
  savingFormat?: 'image' | 'pdf' | null;
  canSave?: boolean;
};

const DETAIL_STATUS_HEX: Record<string, string> = {
  Done: '#0B6E4F',
  Waiting: '#A84C08',
  'Not done': '#B3231A',
  'Money returned': '#1D5BC7',
  Closed: '#46574F',
  'Held for review': '#A84C08',
};

/** Standalone receipt — same new design as History → See details (Messages alerts). */
export default function TransactionDetail(props: TransactionDetailProps) {
  const c = useC();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const receiptRef = useRef<RNView>(null);
  const detail = props.detail ?? null;
  const status = detail?.status || 'Done';
  const saveBusy = !!props.savingFormat;

  const say = useMemo(() => {
    if (props.detailLoading) return 'Loading receipt.';
    if (props.errorMessage) return props.errorMessage;
    if (!detail) return 'Transaction details.';
    return (
      detail.title +
      '. ' +
      detail.rows.map((r) => r[0] + ' ' + r[1]).join('. ') +
      '. ' +
      status +
      '.'
    );
  }, [detail, props.detailLoading, props.errorMessage, status]);

  if (props.detailLoading) {
    return (
      <Screen>
        <TopBar say={say} />
        <Loading title="Loading receipt" text="Just a moment." />
      </Screen>
    );
  }

  if (props.errorMessage || !detail) {
    return (
      <Screen gap={16}>
        <TopBar say={say} />
        <H1>Could not open</H1>
        <Txt size={17} color="text2">
          {props.errorMessage || 'This transaction was not found.'}
        </Txt>
        {props.onRetry && props.errorMessage ? (
          <Btn label="Try again" onPress={() => props.onRetry?.()} />
        ) : null}
        <Btn kind="outline" size="mid" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/Messages'))} />
      </Screen>
    );
  }

  return (
    <Screen scroll gap={12}>
      <TopBar say={say} />
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
                    fit
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
            label={props.savingFormat === 'image' ? 'Saving…' : 'Save as image'}
            disabled={saveBusy}
            onPress={() => props.onSaveImage?.(receiptRef)}
            style={{ flex: 1 }}
          />
          <Btn
            size="mid"
            kind="outline"
            label={props.savingFormat === 'pdf' ? 'Saving…' : 'Save as PDF'}
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
        onPress={() => router.push('/MoreHelp')}
      />
    </Screen>
  );
}
