import { Redirect, type Href } from 'expo-router';

/** Legacy exchange tab → design Change. */
export default function TabsExchangeRedirect() {
  return <Redirect href={'/Change' as Href} />;
}
