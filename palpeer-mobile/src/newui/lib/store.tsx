import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/**
 * Transitional UI-local store for newui feature modules that still call useStore.
 * Live screens should prefer bridge props; this only covers leftover sample UI bits
 * (e.g. unread badge fallback) until those call sites are fully adapted.
 */
type State = {
  balances: Record<string, number>;
  owned: string[];
  onHold: boolean;
  verified: boolean;
  unread: number;
  signedIn: boolean;
};
type Ctx = State & {
  set: (p: Partial<State>) => void;
  move: (code: string, delta: number) => void;
};

const initial: State = {
  balances: {},
  owned: [],
  onHold: false,
  verified: true,
  unread: 0,
  signedIn: false,
};

const StoreCtx = createContext<Ctx>({ ...initial, set: () => {}, move: () => {} });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const value = useMemo<Ctx>(
    () => ({
      ...s,
      set: (p) => setS((o) => ({ ...o, ...p })),
      move: (code, delta) =>
        setS((o) => ({
          ...o,
          balances: { ...o.balances, [code]: Math.max(0, (o.balances[code] || 0) + delta) },
        })),
    }),
    [s],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
