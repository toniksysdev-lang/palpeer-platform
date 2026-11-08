import { Redirect } from 'expo-router';

/** Legacy tab Home → design Main (painted tab bar lives on design screens). */
export default function TabsHomeRedirect() {
  return <Redirect href="/Main" />;
}
