import { Redirect } from 'expo-router';

/** Legacy personal-info form → design About me / Complete my profile flow. */
export default function ProfilePersonalRedirect() {
  return <Redirect href="/StartDetails" />;
}
