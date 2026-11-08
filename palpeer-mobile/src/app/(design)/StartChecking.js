// Route for the "StartChecking" artboard — polls ComplyCube / KYC status.
import StartScreen from '@/design/screens/Start';
import { useKycStatusNavigation } from '@/design/bridge/useLiveKyc';
import { useLiveStart } from '@/design/bridge/useLiveStart';
import { screen } from '@/design/dc/route';

function useLiveChecking() {
  useKycStatusNavigation();
  return useLiveStart();
}

export default screen(StartScreen, { stage: 'checking' }, useLiveChecking);
