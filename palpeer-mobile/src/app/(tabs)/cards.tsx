import { Redirect, type Href } from 'expo-router';

/** Legacy cards tab → design More (cards live under More / Card). */
export default function TabsCardsRedirect() {
  return <Redirect href={'/More' as Href} />;
}
