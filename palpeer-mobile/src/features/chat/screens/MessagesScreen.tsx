import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { NotificationsScreen } from '@/features/notifications/screens/NotificationsScreen';

import { type MessagesSection } from '../components/MessagesSectionControl';
import { ChatRoomsScreen } from './ChatRoomsScreen';

export type { MessagesSection };

/**
 * Messages tab (design change map): Price talks (P2P chat) + Alerts (notifications).
 * Home bell deep-links with `?section=alerts`.
 */
export function MessagesScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<MessagesSection>(
    params.section === 'alerts' ? 'alerts' : 'talks',
  );

  useEffect(() => {
    if (params.section === 'alerts') setSection('alerts');
    if (params.section === 'talks') setSection('talks');
  }, [params.section]);

  if (section === 'alerts') {
    return (
      <NotificationsScreen
        embedded
        messagesSection={section}
        onMessagesSectionChange={setSection}
      />
    );
  }

  return (
    <ChatRoomsScreen
      embedded
      messagesSection={section}
      onMessagesSectionChange={setSection}
    />
  );
}
