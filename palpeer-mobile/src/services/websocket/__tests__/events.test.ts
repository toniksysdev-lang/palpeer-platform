import { parseChatMessage, parseNegotiation, parseReadReceipt } from '../events';
import { brokerUrl } from '../url';

describe('brokerUrl', () => {
  it("points a native WebSocket at SockJS's raw transport", () => {
    expect(brokerUrl('ws://10.0.2.2:8085/ws')).toBe('ws://10.0.2.2:8085/ws/websocket');
    expect(brokerUrl('wss://api.example.test/ws/')).toBe('wss://api.example.test/ws/websocket');
    expect(brokerUrl('https://api.example.test/ws')).toBe('wss://api.example.test/ws/websocket');
    expect(brokerUrl('http://localhost:8085/ws')).toBe('ws://localhost:8085/ws/websocket');
    expect(brokerUrl('ws://host/ws/websocket')).toBe('ws://host/ws/websocket');
  });

  it('returns null when no URL is configured', () => {
    expect(brokerUrl('')).toBeNull();
    expect(brokerUrl('   ')).toBeNull();
  });
});

describe('parseChatMessage', () => {
  const base = { id: 'm-1', roomId: 'r-1', senderId: 'u-2', content: 'Hi', clientMessageId: 'c-1' };

  it('reads an ISO timestamp as is', () => {
    expect(
      parseChatMessage(JSON.stringify({ ...base, createdAt: '2026-09-29T10:00:00Z' })),
    ).toEqual({ ...base, createdAt: '2026-09-29T10:00:00Z' });
  });

  it('converts epoch seconds with nanoseconds from the broker converter', () => {
    const message = parseChatMessage(
      `{"id":"m-1","roomId":"r-1","senderId":"u-2","content":"Hi","clientMessageId":null,"createdAt":1790676000.123456789}`,
    );
    expect(message?.createdAt).toBe('2026-09-29T10:00:00.123Z');
    expect(message?.clientMessageId).toBeNull();
  });

  it('rejects frames that are not chat messages', () => {
    expect(parseChatMessage('nope')).toBeNull();
    expect(parseChatMessage('null')).toBeNull();
    expect(parseChatMessage(JSON.stringify({ id: 'm-1', roomId: 'r-1' }))).toBeNull();
  });
});

describe('parseReadReceipt', () => {
  it('reads a receipt with an ISO or epoch timestamp', () => {
    expect(
      parseReadReceipt('{"roomId":"r-1","userId":"u-2","lastReadAt":"2026-09-29T10:00:00Z"}'),
    ).toEqual({ roomId: 'r-1', userId: 'u-2', lastReadAt: '2026-09-29T10:00:00Z' });
    expect(
      parseReadReceipt('{"roomId":"r-1","userId":"u-2","lastReadAt":1790676000.5}')?.lastReadAt,
    ).toBe('2026-09-29T10:00:00.500Z');
  });

  it('rejects frames that are not receipts', () => {
    expect(parseReadReceipt('nope')).toBeNull();
    expect(parseReadReceipt('{"roomId":"r-1","userId":"u-2"}')).toBeNull();
    expect(parseReadReceipt('{"roomId":"r-1","lastReadAt":"2026-09-29T10:00:00Z"}')).toBeNull();
  });
});

describe('parseNegotiation', () => {
  const frame = (extra = '') =>
    '{"id":"n-1","p2pRequestId":"r-1","requesterId":"u-1","counterpartyId":"u-2",' +
    '"status":"OPEN","currentOfferId":"o-1","createdAt":"2026-09-29T09:00:00Z",' +
    '"offers":[{"id":"o-1","offeredBy":"u-2","offerType":"OFFER",' +
    '"amount":12345678901234567.8901,"rate":1475.123456789012,"status":"PENDING",' +
    `"createdAt":"2026-09-29T09:00:00Z"}]${extra}}`;

  it('keeps money exact, beyond what a JS number can hold', () => {
    const negotiation = parseNegotiation(frame());
    expect(negotiation?.offers[0]?.amount).toBe('12345678901234567.8901');
    expect(negotiation?.offers[0]?.rate).toBe('1475.123456789012');
  });

  it('defaults the lifecycle fields when an older server leaves them out', () => {
    expect(parseNegotiation(frame())).toMatchObject({
      p2pOrderId: null,
      closedReason: null,
      closedBy: null,
    });
    expect(
      parseNegotiation(frame(',"p2pOrderId":"o-9","closedReason":null,"closedBy":null'))
        ?.p2pOrderId,
    ).toBe('o-9');
  });

  it('rejects frames that are not negotiations', () => {
    expect(parseNegotiation('nope')).toBeNull();
    expect(parseNegotiation('null')).toBeNull();
    expect(parseNegotiation('{"id":"n-1","p2pRequestId":"r-1","status":"OPEN"}')).toBeNull();
  });
});
