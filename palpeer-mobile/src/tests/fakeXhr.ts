type Reply = { status: number; body?: unknown };
export type XhrOutcome = Reply | 'network-error' | 'timeout' | 'hang';

export type XhrRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  /** RN FormData parts: text parts carry `string`, file parts carry `uri`/`name`/`type`. */
  parts: Record<string, unknown>[];
};

type Handler = (request: XhrRequest) => XhrOutcome;

const API_PREFIX = '/api/v1';

/**
 * XMLHttpRequest double for multipart uploads. Each send reports 50% then 100% progress and
 * resolves with the handler's outcome; 'hang' leaves the request open (see `FakeXhr.respond`).
 */
export function installFakeXhr(routes: Record<string, XhrOutcome | XhrOutcome[] | Handler>) {
  const requests: XhrRequest[] = [];
  const instances: FakeXhr[] = [];
  const queues = new Map<string, XhrOutcome[]>();

  class FakeXhr {
    status = 0;
    responseText = '';
    timeout = 0;
    aborted = false;
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    private method = 'GET';
    private path = '';
    private headers: Record<string, string> = {};

    constructor() {
      instances.push(this);
    }

    open(method: string, url: string) {
      this.method = method.toUpperCase();
      const { pathname } = new URL(url);
      this.path = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : pathname;
    }

    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }

    abort() {
      this.aborted = true;
    }

    send(body: unknown) {
      const form = body as {
        getParts?: () => Record<string, unknown>[];
        entries?: () => Iterable<[string, unknown]>;
      } | null;
      const parts =
        form?.getParts?.() ??
        (form?.entries
          ? [...form.entries()].map(([fieldName, value]) => ({ fieldName, string: value }))
          : []);
      const request: XhrRequest = {
        method: this.method,
        path: this.path,
        headers: { ...this.headers },
        parts,
      };
      requests.push(request);

      const key = `${this.method} ${this.path}`;
      const route = routes[key];
      let outcome: XhrOutcome | undefined;
      if (typeof route === 'function') {
        outcome = route(request);
      } else if (Array.isArray(route)) {
        if (!queues.has(key)) queues.set(key, [...route]);
        outcome = queues.get(key)?.shift();
      } else {
        outcome = route;
      }
      if (!outcome) throw new Error(`Unexpected upload: ${key}`);
      if (outcome === 'hang') return;
      const resolved = outcome;
      setTimeout(() => this.respond(resolved), 0);
    }

    progress(loaded: number, total: number) {
      this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
    }

    respond(outcome: Exclude<XhrOutcome, 'hang'>) {
      if (this.aborted) return;
      if (outcome === 'network-error') {
        this.onerror?.();
        return;
      }
      if (outcome === 'timeout') {
        this.ontimeout?.();
        return;
      }
      this.progress(50, 100);
      this.status = outcome.status;
      this.responseText = outcome.body === undefined ? '' : JSON.stringify(outcome.body);
      this.onload?.();
    }
  }

  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  return { requests, instances };
}

export function created(data: unknown): Reply {
  return { status: 201, body: { success: true, data, timestamp: '' } };
}

/** Value of a multipart part by field name (RN file parts expose their `uri`). */
export function partValue(request: XhrRequest | undefined, field: string): unknown {
  const part = request?.parts.find((item) => {
    const disposition = (item.headers as Record<string, string> | undefined)?.[
      'content-disposition'
    ];
    return item.fieldName === field || disposition?.includes(`name="${field}"`);
  });
  return part?.string ?? part?.uri;
}
