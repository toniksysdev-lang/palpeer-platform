import { supportChatRequest } from './supportChatClient';

export type AiChatResponse = {
  response?: string;
  message?: string;
  sessionId?: string;
  shouldEscalate?: boolean;
  data?: { response?: string; sessionId?: string; shouldEscalate?: boolean };
};

export type StartSessionResponse = {
  sessionId?: string;
};

export type AutoAssignAgentResponse = {
  agentAvailable?: boolean;
  pending?: boolean;
  agentId?: number;
  agentName?: string;
  message?: string;
};

export type AgentsOnlineResponse = {
  online?: boolean;
  count?: number;
};

export type GuestChatMessage = {
  id?: number | string;
  message?: string;
  text?: string;
  senderType?: string | number;
  createdAt?: string;
  userName?: string;
};

function unwrapAi(data: AiChatResponse): {
  text: string;
  sessionId?: string;
  shouldEscalate: boolean;
} {
  const text =
    data.response ||
    data.message ||
    data.data?.response ||
    "I apologize, but I couldn't process that right now.";
  return {
    text,
    sessionId: data.sessionId ?? data.data?.sessionId,
    shouldEscalate: Boolean(data.shouldEscalate ?? data.data?.shouldEscalate),
  };
}

/** Start a guest AI chat session. */
export async function startGuestAiSession(): Promise<
  { ok: true; sessionId: string } | { ok: false; error: string }
> {
  let lastError = 'Could not start chat session.';
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await supportChatRequest<StartSessionResponse>('/ai/start-session/guest', {
      method: 'POST',
      body: {},
    });
    if (result.ok && result.data?.sessionId) {
      return { ok: true, sessionId: result.data.sessionId };
    }
    lastError = result.ok ? lastError : result.error.message;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return { ok: false, error: lastError };
}

/** Link the logged-in Palpeer email to the support chat session when possible. */
export async function verifyPalpeerAccount(
  email: string,
  sessionId: string,
): Promise<{ ok: boolean; firstName?: string | null }> {
  const result = await supportChatRequest<{ firstName?: string; FirstName?: string }>(
    '/ai/verify-palpeer-account/guest',
    { method: 'POST', body: { email, sessionId } },
  );
  if (!result.ok) return { ok: false };
  return {
    ok: true,
    firstName: result.data.firstName ?? result.data.FirstName ?? null,
  };
}

/** Send a user message to the AI assistant (guest endpoint + account context). */
export async function sendAiGuestChat(input: {
  message: string;
  sessionId?: string;
  userEmail?: string | null;
  context?: string | null;
}): Promise<
  | { ok: true; text: string; sessionId?: string; shouldEscalate: boolean }
  | { ok: false; error: string }
> {
  const result = await supportChatRequest<AiChatResponse>('/ai/chat/guest', {
    method: 'POST',
    body: {
      message: input.message,
      sessionId: input.sessionId,
      userEmail: input.userEmail || undefined,
      context: input.context || undefined,
    },
  });
  if (!result.ok) return { ok: false, error: result.error.message };
  return { ok: true, ...unwrapAi(result.data) };
}

export async function getAgentsOnline(): Promise<AgentsOnlineResponse> {
  const result = await supportChatRequest<AgentsOnlineResponse>('/chat/agents-online');
  return result.ok ? result.data : { online: false, count: 0 };
}

/** Public support ticket (no agent auth) — same endpoint as app.palpeer.com.ng /submit-ticket. */
export type CreatePublicTicketRequest = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  company?: string;
  subject: string;
  description: string;
  /** Support app uses numeric priority; chat form defaults to 3. */
  priority?: number;
  /** Origin: AIChat matches the web chat escalation form. */
  source?: string;
};

export type CreatePublicTicketResponse = {
  ticketNumber?: string;
  accessToken?: string;
  trackingUrl?: string;
  expectedResponseTime?: string;
  message?: string;
};

export async function createPublicTicket(
  input: CreatePublicTicketRequest,
): Promise<
  | { ok: true; data: CreatePublicTicketResponse }
  | { ok: false; error: string }
> {
  const result = await supportChatRequest<CreatePublicTicketResponse>('/publictickets', {
    method: 'POST',
    body: {
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phoneNumber: input.phoneNumber?.trim() || undefined,
      company: input.company?.trim() || undefined,
      subject: input.subject.trim(),
      description: input.description.trim(),
      priority: input.priority ?? 3,
      source: input.source ?? 'AIChat',
    },
  });
  if (!result.ok) return { ok: false, error: result.error.message };
  return { ok: true, data: result.data };
}

/** Absolute track URL on the support site. */
export function supportTicketTrackingUrl(ticket: CreatePublicTicketResponse): string | null {
  if (ticket.trackingUrl) {
    if (/^https?:\/\//i.test(ticket.trackingUrl)) return ticket.trackingUrl;
    const path = ticket.trackingUrl.startsWith('/') ? ticket.trackingUrl : `/${ticket.trackingUrl}`;
    return `https://app.palpeer.com.ng${path}`;
  }
  if (ticket.accessToken && ticket.ticketNumber) {
    return `https://app.palpeer.com.ng/track-ticket?token=${encodeURIComponent(ticket.accessToken)}&ticket=${encodeURIComponent(ticket.ticketNumber)}`;
  }
  return null;
}

export async function autoAssignAgent(
  sessionId: string,
): Promise<
  { ok: true; data: AutoAssignAgentResponse } | { ok: false; error: string }
> {
  const result = await supportChatRequest<AutoAssignAgentResponse>('/chat/auto-assign-agent', {
    method: 'POST',
    body: { sessionId },
  });
  if (!result.ok) return { ok: false, error: result.error.message };
  return { ok: true, data: result.data };
}

export async function sendGuestAgentMessage(
  sessionId: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await supportChatRequest('/chat/guest/send-message', {
    method: 'POST',
    body: { sessionId, message },
  });
  if (!result.ok) return { ok: false, error: result.error.message };
  return { ok: true };
}

export async function getGuestMessages(
  sessionId: string,
): Promise<GuestChatMessage[]> {
  const result = await supportChatRequest<GuestChatMessage[] | { messages?: GuestChatMessage[] }>(
    `/chat/guest/${encodeURIComponent(sessionId)}/messages`,
  );
  if (!result.ok) return [];
  if (Array.isArray(result.data)) return result.data;
  if (result.data && Array.isArray(result.data.messages)) return result.data.messages;
  return [];
}

export function mapGuestSender(senderType: GuestChatMessage['senderType']): 'user' | 'ai' | 'agent' {
  if (typeof senderType === 'number') {
    if (senderType === 2) return 'agent';
    if (senderType === 1) return 'user';
    return 'ai';
  }
  const value = String(senderType ?? '').toLowerCase();
  if (value.includes('agent')) return 'agent';
  if (value.includes('user') || value.includes('customer') || value.includes('guest')) return 'user';
  return 'ai';
}
