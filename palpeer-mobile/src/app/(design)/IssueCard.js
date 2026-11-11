// Route for Issue a card — newui presentation, live backend props.
import { useLiveIssueCard } from '@/design/bridge/useLiveIssueCard';
import { liveScreen } from '@/design/dc/route';
import IssueCardScreen from '@/newui/screens/IssueCard';

export default liveScreen(IssueCardScreen, {}, useLiveIssueCard);
