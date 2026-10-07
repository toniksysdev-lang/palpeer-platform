/**
 * The backend registers `/ws` with SockJS, so a native WebSocket must use SockJS's raw transport
 * at `/ws/websocket` (plain `/ws` has SockJS framing and won't speak STOMP).
 */
export function brokerUrl(wsUrl: string): string | null {
  const trimmed = wsUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const url = trimmed.replace(/^http(s?):\/\//i, 'ws$1://');
  return url.endsWith('/websocket') ? url : `${url}/websocket`;
}
