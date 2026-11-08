import { Redirect, type Href } from 'expo-router';

/** Legacy path → design MyPromotions. */
export default function PromotionsRedirect() {
  return <Redirect href={'/MyPromotions' as Href} />;
}