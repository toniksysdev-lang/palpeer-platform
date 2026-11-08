import { Redirect, type Href } from 'expo-router';

/** Legacy path → design MyBonuses. */
export default function BonusesRedirect() {
  return <Redirect href={'/MyBonuses' as Href} />;
}
