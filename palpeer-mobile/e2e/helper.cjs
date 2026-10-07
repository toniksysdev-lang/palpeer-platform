/**
 * Local test helper for the Maestro flows. It plays the parts the app user can't: reading the
 * development OTP from the backend log, completing a funding as an operator, and acting as the
 * P2P counterparty. Development backends only: it needs `OTP_LOG_CODE=true` and the seeded admin.
 */
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');

const API = process.env.E2E_API ?? 'http://127.0.0.1:8085/api/v1';
const BACKEND_LOG = process.env.E2E_BACKEND_LOG;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@palpeer.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const ADB = process.env.E2E_ADB ?? 'adb';
const PASSWORD = 'E2e-Passw0rd!';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const adb = (args) =>
  new Promise((resolve, reject) =>
    execFile(ADB, ['-e', ...args], (error, stdout) => (error ? reject(error) : resolve(stdout))),
  );

async function call(method, path, token, body) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') headers['Idempotency-Key'] = crypto.randomUUID();
  const response = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${json?.error?.code ?? ''}`);
  }
  return json?.data;
}

async function latestOtp(email, purpose) {
  if (!BACKEND_LOG) throw new Error('E2E_BACKEND_LOG is not set');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const lines = fs
      .readFileSync(BACKEND_LOG, 'utf8')
      .split('\n')
      .filter((line) => line.includes('DEV OTP') && line.includes(email) && line.includes(purpose));
    const match = /code=(\d+)/.exec(lines.at(-1) ?? '');
    if (match) return match[1];
    await sleep(500);
  }
  throw new Error(`No ${purpose} OTP logged for ${email}`);
}

async function login(email, password) {
  return (await call('POST', '/auth/login', undefined, { email, password })).accessToken;
}

async function createVerifiedUser(tag) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const phone = `+1555${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  await call('POST', '/auth/register', undefined, { email, phone, password: PASSWORD });
  const code = await latestOtp(email, 'EMAIL_VERIFICATION');
  await call('POST', '/auth/otp/verify', undefined, {
    email,
    purpose: 'EMAIL_VERIFICATION',
    channel: 'EMAIL',
    code,
  });
  return { email, token: await login(email, PASSWORD) };
}

let counterparty = null;

const actions = {
  /** GET /otp?email=&purpose= */
  async otp(query) {
    return {
      code: await latestOtp(query.get('email'), query.get('purpose') ?? 'EMAIL_VERIFICATION'),
    };
  },

  /**
   * Types into the focused field with `adb input text` (clearing it first when clear=1). Maestro's
   * own inputText stalls on slow emulators.
   */
  async type(query) {
    const text = query.get('text') ?? '';
    if (query.get('clear') === '1') {
      await adb(['shell', 'input', 'keyevent', 'KEYCODE_MOVE_END']);
      await adb(['shell', 'input', 'keyevent', ...Array(40).fill('KEYCODE_DEL')]);
    }
    if (text) {
      const escaped = text.replace(/[\\()<>|;&*~"'`$!?#\[\]{}]/g, '\\$&').replace(/ /g, '%s');
      await adb(['shell', 'input', 'text', escaped]);
    }
    return { typed: text.length };
  },

  /** A registered, email-verified user, for running flows after 02 on their own. */
  async verifiedUser() {
    const { email } = await createVerifiedUser('app');
    return { email };
  },

  /** Completes the app user's newest open funding, as the payment operator would. */
  async completeFunding(query) {
    const token = await login(query.get('email'), query.get('password'));
    const recent = await call('GET', '/transactions/recent?limit=20', token);
    const funding = recent.find(
      (item) =>
        item.type === 'FUNDING' && ['INITIATED', 'PENDING', 'PROCESSING'].includes(item.status),
    );
    if (!funding) throw new Error('No open funding for this user');
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const done = await call('POST', `/funding/${funding.id}/process`, admin, {});
    return { fundingId: funding.id, status: done.status };
  },

  /** Creates the counterparty and an open SELL request the app user can make an offer on. */
  async counterpartyRequest() {
    counterparty = await createVerifiedUser('peer');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const request = await call('POST', '/p2p/requests', counterparty.token, {
      side: 'SELL',
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
      amount: 40,
      rate: 1000,
      expiresAt,
      notes: 'E2E counterparty request',
    });
    return { requestId: request.id, email: counterparty.email };
  },

  /** The counterparty counters the open negotiation on its request. */
  async counterpartyCounter(query) {
    if (!counterparty) throw new Error('counterpartyRequest must run first');
    const mine = await call('GET', '/negotiations/me', counterparty.token);
    const list = Array.isArray(mine) ? mine : (mine?.content ?? []);
    const open = list.find((item) => item.status === 'OPEN');
    if (!open) throw new Error('No open negotiation for the counterparty');
    const countered = await call('POST', `/negotiations/${open.id}/counter`, counterparty.token, {
      amount: Number(query.get('amount') ?? 40),
      rate: Number(query.get('rate') ?? 1010),
    });
    return { negotiationId: countered.id, status: countered.status };
  },

  /**
   * Touches the emulator's fingerprint sensor with finger 1, shortly after replying so the flow
   * can reach the prompt first.
   */
  async fingerTouch() {
    setTimeout(() => adb(['emu', 'finger', 'touch', '1']).catch(() => {}), 1500);
    return { scheduled: true };
  },

  /** The counterparty replies in the order's chat room. */
  async counterpartyMessage(query) {
    if (!counterparty) throw new Error('counterpartyRequest must run first');
    const rooms = await call('GET', '/chat/rooms', counterparty.token);
    const room = (Array.isArray(rooms) ? rooms : (rooms?.content ?? []))[0];
    if (!room) throw new Error('The counterparty has no chat room');
    await call('POST', `/chat/rooms/${room.id}/messages`, counterparty.token, {
      content: query.get('text') ?? 'Hello from the counterparty',
      clientMessageId: crypto.randomUUID(),
    });
    return { roomId: room.id };
  },
};

function start(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const action = actions[url.pathname.slice(1)];
    res.setHeader('Content-Type', 'application/json');
    if (!action) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'unknown action' }));
      return;
    }
    try {
      const result = await action(url.searchParams);
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error.message ?? error) }));
      console.error(`[helper] ${url.pathname} failed: ${error.message ?? error}`);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start, PASSWORD };
