import { router } from 'expo-router';
import type { DesignWallet } from '@/design/bridge/mapWallet';
import { fmt, W, WALLETS } from '@/newui/lib/money';
import { useStore } from '@/newui/lib/store';
import { Btn, Choice, Flag, H1, Overlay, Screen, TopBar } from '@/newui/ui/kit';

/** Full-screen list of open wallets to choose from. */
export function WalletPicker({
  open,
  title,
  skip,
  current,
  onPick,
  onClose,
  showAdd = true,
  liveWallets,
}: {
  open: boolean;
  title: string;
  skip?: string;
  current?: string;
  onPick: (code: string) => void;
  onClose: () => void;
  showAdd?: boolean;
  liveWallets?: DesignWallet[];
}) {
  const st = useStore();
  const list =
    liveWallets?.filter((w) => w.on !== false && w.code !== skip) ??
    WALLETS.filter((w) => w.on !== false && w.code !== skip && st.owned.includes(w.code));
  return (
    <Overlay open={open}>
      <Screen scroll>
        <TopBar onBack={onClose} />
        <H1>{title}</H1>
        {list.map((w) => {
          const meta = W(w.code);
          const bal = 'bal' in w && typeof w.bal === 'number' ? w.bal : st.balances[w.code] || 0;
          return (
            <Choice
              key={w.code}
              title={w.name || meta.name}
              note={'You have ' + fmt(w.code, bal)}
              icon={<Flag cc={meta.cc} w={60} />}
              on={w.code === current}
              onPress={() => onPick(w.code)}
              minH={80}
            />
          );
        })}
        {showAdd ? (
          <Btn
            kind="outline"
            size="mid"
            label="Add a wallet"
            onPress={() => {
              onClose();
              router.replace('/Main');
            }}
          />
        ) : null}
      </Screen>
    </Overlay>
  );
}
