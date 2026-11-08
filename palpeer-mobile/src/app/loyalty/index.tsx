import { Redirect, type Href } from 'expo-router';

/** Legacy path → design MyPoints. */
export default function LoyaltyRedirect() {
  return <Redirect href={'/MyPoints' as Href} />;
}
