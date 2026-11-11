import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Legacy tab Messages → design Messages (preserve ?section=alerts). */
export default function TabsMessagesRedirect() {
  const params = useLocalSearchParams<{ section?: string }>();
  const href =
    params.section === 'alerts'
      ? ('/Messages?section=alerts' as Href)
      : params.section === 'talks'
        ? ('/Messages?section=talks' as Href)
        : ('/Messages' as Href);
  return <Redirect href={href} />;
}
