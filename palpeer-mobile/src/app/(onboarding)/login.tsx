import { Redirect, type Href } from 'expo-router';

/** Legacy login → design StartLogin. */
export default function LoginRedirect() {
  return <Redirect href={'/StartLogin' as Href} />;
}
