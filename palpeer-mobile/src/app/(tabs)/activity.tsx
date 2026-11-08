import { Redirect, type Href } from 'expo-router';

/** Legacy tab History /activity → design History. */
export default function TabsHistoryRedirect() {
  return <Redirect href={'/History' as Href} />;
}
