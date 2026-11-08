import { Redirect, type Href } from 'expo-router';

/** Legacy tab More → design More. */
export default function TabsMoreRedirect() {
  return <Redirect href={'/More' as Href} />;
}
