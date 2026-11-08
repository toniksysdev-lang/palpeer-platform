import { Redirect, type Href } from 'expo-router';

/** Legacy path → design InviteFriends. */
export default function ReferralsRedirect() {
  return <Redirect href={'/InviteFriends' as Href} />;
}
