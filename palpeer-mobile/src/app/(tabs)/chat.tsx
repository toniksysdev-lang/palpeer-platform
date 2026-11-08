import { Redirect, type Href } from 'expo-router';

/** Legacy tab Messages → design Messages. */
export default function TabsMessagesRedirect() {
  return <Redirect href={'/Messages' as Href} />;
}
