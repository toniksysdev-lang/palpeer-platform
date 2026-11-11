import { Btn, Card, H1, Loading, Overlay, P, Row, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Device = { id: string; title: string; note: string };

type Props = {
  backend?: boolean;
  loading?: boolean;
  loadError?: string | null;
  enabledHere?: boolean;
  pushNote?: string;
  busy?: boolean;
  error?: string | null;
  blocked?: boolean;
  otherDevices?: Device[];
  removingId?: string | null;
  removeBusy?: boolean;
  onToggleThisPhone?: () => void | Promise<void>;
  onAskRemoveDevice?: (id: string) => void;
  onCancelRemove?: () => void;
  onConfirmRemove?: () => void | Promise<void>;
  onOpenPhoneSettings?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
};

/** Push notifications on this phone + other devices. */
export default function NotificationSettings(props: Props) {
  const devices = props.otherDevices ?? [];
  const removing = props.removingId
    ? devices.find((d) => d.id === props.removingId) || { title: 'that device', note: '', id: '' }
    : null;
  const enabled = !!props.enabledHere;

  if (props.loading) {
    return (
      <Screen>
        <TopBar onBack={() => props.onBack?.()} />
        <Loading title="Loading notification settings" />
      </Screen>
    );
  }

  if (props.loadError) {
    return (
      <Screen gap={12}>
        <TopBar onBack={() => props.onBack?.()} />
        <H1>Notification settings</H1>
        <Txt size={17} color="red" noTr>
          {props.loadError}
        </Txt>
        <Btn size="mid" label="Try again" onPress={() => props.onRetry?.()} />
      </Screen>
    );
  }

  return (
    <Screen scroll gap={12}>
      <TopBar
        onBack={() => props.onBack?.()}
        say={`Notification settings. Push notifications on this phone. ${enabled ? 'On.' : 'Off.'} ${props.pushNote || ''}`}
      />
      <H1>Notification settings</H1>

      <Card
        gap={10}
        style={{ borderWidth: 3, borderColor: enabled ? '#0B6E4F' : 'transparent' }}
      >
        <Row between>
          <Txt size={18} w="800" style={{ flex: 1 }}>
            Push on this phone
          </Txt>
          <Txt size={16} w="800" color={enabled ? 'brandText' : 'text2'}>
            {enabled ? 'On' : 'Off'}
          </Txt>
        </Row>
        <Txt size={15} color="text2" noTr>
          {props.pushNote || ''}
        </Txt>
        <Btn
          size="small"
          kind={enabled ? 'outline' : 'primary'}
          label={props.busy ? 'Please wait…' : enabled ? 'Turn off' : 'Turn on'}
          disabled={props.busy}
          onPress={() => void props.onToggleThisPhone?.()}
        />
        {props.blocked ? (
          <Btn size="small" kind="link" label="Open phone settings" onPress={() => props.onOpenPhoneSettings?.()} />
        ) : null}
        {props.error ? (
          <Txt size={15} color="red" noTr>
            {props.error}
          </Txt>
        ) : null}
      </Card>

      <Txt size={18} w="800">
        Other devices
      </Txt>
      {devices.length === 0 ? (
        <Card>
          <Txt size={16} color="text2">
            No other devices.
          </Txt>
        </Card>
      ) : (
        devices.map((d) => (
          <Card key={d.id} gap={6}>
            <Txt size={17} w="800" noTr>
              {d.title}
            </Txt>
            <Txt size={15} color="text2" noTr>
              {d.note}
            </Txt>
            <Btn size="small" kind="outline" label="Remove" onPress={() => props.onAskRemoveDevice?.(d.id)} />
          </Card>
        ))
      )}

      <Overlay open={!!removing}>
        <Screen gap={12}>
          <H1>Remove this device?</H1>
          <P noTr>{`Stop push alerts on ${removing?.title || 'that device'}.`}</P>
          <Btn
            size="mid"
            label={props.removeBusy ? 'Removing…' : 'Yes, remove'}
            disabled={props.removeBusy}
            onPress={() => void props.onConfirmRemove?.()}
          />
          <Btn size="mid" kind="outline" label="Cancel" onPress={() => props.onCancelRemove?.()} />
        </Screen>
      </Overlay>
    </Screen>
  );
}
