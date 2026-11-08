import { Redirect, type Href } from 'expo-router';

/** Legacy P2P tab → design People marketplace. */
export default function TabsP2pRedirect() {
  return <Redirect href={'/People' as Href} />;
}
