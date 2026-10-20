/** `rawBody` sends exact JSON text (e.g. money with more digits than a JS number holds). */
type Reply = { status: number; body?: unknown; rawBody?: string };
type Handler = (request: {
  body: unknown;
  headers: Record<string, string>;
  query: string;
}) => Reply;

export type RecordedCall = {
  method: string;
  path: string;
  body: unknown;
  /** The request body exactly as sent. */
  rawBody: string | undefined;
  query: string;
  headers: Record<string, string>;
};

const API_PREFIX = '/api/v1';

export function ok(data?: unknown, message?: string): Reply {
  return { status: 200, body: { success: true, data, message, timestamp: '' } };
}

export function fail(status: number, code: string, message = code): Reply {
  return { status, body: { success: false, message, error: { code }, timestamp: '' } };
}

/**
 * Minimal fetch double keyed by "METHOD /path" (path relative to /api/v1). Handlers can be a
 * reply or a queue of replies consumed in order. Unmatched requests fail the test loudly.
 */
export function installFetchMock(routes: Record<string, Reply | Reply[] | Handler>) {
  const calls: RecordedCall[] = [];
  const queues = new Map<string, Reply[]>();

  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const { pathname, search } = new URL(url);
    const path = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : pathname;
    const headers = (init.headers ?? {}) as Record<string, string>;
    const rawBody = typeof init.body === 'string' ? init.body : undefined;
    const body = rawBody ? JSON.parse(rawBody) : undefined;
    calls.push({ method, path, body, rawBody, query: search, headers });

    const key = `${method} ${path}`;
    const route = routes[key];
    let reply: Reply | undefined;
    if (typeof route === 'function') {
      reply = route({ body, headers, query: search });
    } else if (Array.isArray(route)) {
      if (!queues.has(key)) queues.set(key, [...route]);
      reply = queues.get(key)?.shift();
    } else {
      reply = route;
    }
    if (!reply) throw new Error(`Unexpected request: ${key}`);

    const status = reply.status;
    const text = reply.rawBody ?? (reply.body === undefined ? '' : JSON.stringify(reply.body));
    return { ok: status >= 200 && status < 300, status, text: async () => text } as Response;
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}
