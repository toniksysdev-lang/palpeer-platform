// Route for Invite friends — newui presentation, live backend props.
import { useLiveInviteFriends } from '@/design/bridge/useLiveInviteFriends';
import { liveScreen } from '@/design/dc/route';
import InviteFriendsScreen from '@/newui/screens/InviteFriends';

export default liveScreen(InviteFriendsScreen, {}, useLiveInviteFriends);
