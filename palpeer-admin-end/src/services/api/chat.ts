import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type { ChatMessageSummary, ChatRoomSummary } from '@/types/negotiations';

export type AdminChatListParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export async function listAdminChatRooms(
  params: AdminChatListParams & { userId?: string } = {},
): Promise<SpringPage<ChatRoomSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  if (params.userId) search.set('userId', params.userId);
  return apiRequest<SpringPage<ChatRoomSummary>>(`/admin/chat/rooms?${search.toString()}`);
}

export async function getAdminChatRoom(roomId: string): Promise<ChatRoomSummary> {
  return apiRequest<ChatRoomSummary>(`/admin/chat/rooms/${encodeURIComponent(roomId)}`);
}

export async function listAdminChatMessages(
  roomId: string,
  params: AdminChatListParams = {},
): Promise<SpringPage<ChatMessageSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  return apiRequest<SpringPage<ChatMessageSummary>>(
    `/admin/chat/rooms/${encodeURIComponent(roomId)}/messages?${search.toString()}`,
  );
}
