import { Redirect } from 'expo-router';

/** Legacy first-time PIN setup → design StartPinSet. */
export default function SetPinRedirect() {
  return <Redirect href={{ pathname: '/StartPinSet', params: { setupRequired: '1' } }} />;
}
