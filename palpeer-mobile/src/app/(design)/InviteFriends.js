// Route for the "Invite friends" artboard (live backend props).
import InviteFriendsScreen from '@/design/screens/InviteFriends';
import { useLiveInviteFriends } from '@/design/bridge/useLiveInviteFriends';
import { screen } from '@/design/dc/route';

export default screen(InviteFriendsScreen, {}, useLiveInviteFriends);
