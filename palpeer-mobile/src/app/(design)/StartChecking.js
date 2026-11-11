// Route for the "StartChecking" artboard — polls ComplyCube / KYC status.
import StartScreen from '@/newui/screens/Start';
import { useKycStatusNavigation } from '@/design/bridge/useLiveKyc';
import { useLiveStart } from '@/design/bridge/useLiveStart';
import { liveScreen } from '@/design/dc/route';

function useLiveChecking() {
  useKycStatusNavigation();
  return useLiveStart();
}

export default liveScreen(StartScreen, { stage: 'checking' }, useLiveChecking);
