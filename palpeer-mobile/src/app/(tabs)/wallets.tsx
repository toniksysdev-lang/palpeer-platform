import { Redirect, type Href } from 'expo-router';

/** Legacy wallets tab → design Wallets. */
export default function TabsWalletsRedirect() {
  return <Redirect href={'/Wallets' as Href} />;
}
