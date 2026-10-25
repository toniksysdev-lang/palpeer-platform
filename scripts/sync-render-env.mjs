#!/usr/bin/env node
/** One-shot sync of critical palpeer-api env vars on Render (no secret printing). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_YAML = path.join(os.homedir(), '.render', 'cli.yaml');
const SERVICE_ID = 'srv-db3ca6tg1s2s739rpof0';
const PG_ID = 'dpg-db3b06cs728c73btuss0-a';
const KV_ID = 'red-db3b06ijnfac7399b920';
const API = 'https://api.render.com/v1';

function loadApiKey() {
  const text = fs.readFileSync(CLI_YAML, 'utf8');
  const m = text.match(/key:\s*(rnd_\w+)/);
  if (!m) throw new Error('Render API key not found in ~/.render/cli.yaml');
  return m[1];
}

function loadDotenv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    let s = t.startsWith('export ') ? t.slice(7).trim() : t;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function api(method, p, key, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function parsePg(conn) {
  const internal = conn.internalConnectionString || '';
  const m = internal.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!m) throw new Error('Could not parse Postgres internal connection string');
  return {
    host: m[3],
    port: m[4] || '5432',
    db: m[5],
    user: m[1],
    password: conn.password || m[2],
  };
}

function parseRedis(conn) {
  const internal = conn.internalConnectionString || '';
  const external = conn.externalConnectionString || '';
  let host = 'localhost';
  let port = '6379';
  let password = '';
  const mi = internal.match(/^rediss?:\/\/(?::([^@]*)@)?([^:/]+):(\d+)/);
  if (mi) {
    password = mi[1] || '';
    host = mi[2];
    port = mi[3];
  }
  const me = external.match(/^rediss?:\/\/(?::([^@]*)@)?([^:/]+):(\d+)/);
  if (me && me[1]) password = me[1];
  return { host, port, password, ssl: 'false' };
}

const key = loadApiKey();
const local = loadDotenv(path.join(ROOT, '.env'));
const pg = await api('GET', `/postgres/${PG_ID}/connection-info`, key);
const kv = await api('GET', `/key-value/${KV_ID}/connection-info`, key);
const db = parsePg(pg);
const redis = parseRedis(kv);

const env = {
  SPRING_PROFILES_ACTIVE: 'prod',
  OTP_LOG_CODE: 'true',
  DB_HOST: db.host,
  DB_PORT: db.port,
  DB_NAME: db.db,
  DB_USER: db.user,
  DB_PASSWORD: db.password,
  DB_SSLMODE: 'require',
  REDIS_HOST: redis.host,
  REDIS_PORT: redis.port,
  REDIS_SSL: redis.ssl,
  CORS_ALLOWED_ORIGINS: 'https://palpeer-admin.onrender.com',
  KUDA_ENABLED: 'true',
};
if (redis.password) env.REDIS_PASSWORD = redis.password;

const prefixes = [
  'KUDA_',
  'APAYLO_',
  'KORAPAY_',
  'PALPEER_',
  'ADMIN_BOOTSTRAP_',
  'JWT_',
  'GOOGLE_',
  'TELNYX_',
  'TWILIO_',
  'BULKSMS_',
  'COMPLYCUBE_',
];
for (const [k, v] of Object.entries(local)) {
  if (v && prefixes.some((p) => k.startsWith(p))) env[k] = v;
}
env.KUDA_ENABLED = 'true';
// Prefer the service-account file (stable newlines). Never upload a Windows file path to Render.
delete env.PALPEER_FCM_CREDENTIALS_FILE;
const fcmFile =
  (local.PALPEER_FCM_CREDENTIALS_FILE && path.isAbsolute(local.PALPEER_FCM_CREDENTIALS_FILE)
    ? local.PALPEER_FCM_CREDENTIALS_FILE
    : null) || path.join(ROOT, 'secrets', 'firebase-service-account.json');
if (fs.existsSync(fcmFile)) {
  const raw = fs.readFileSync(fcmFile, 'utf8').trim();
  JSON.parse(raw); // fail fast if the file is corrupt
  env.PALPEER_FCM_CREDENTIALS_JSON = raw;
  env.PALPEER_FCM_ENABLED = 'true';
} else {
  env.PALPEER_FCM_ENABLED = 'false';
  delete env.PALPEER_FCM_CREDENTIALS_JSON;
}

const payload = Object.keys(env)
  .sort()
  .map((k) => ({ key: k, value: String(env[k]) }));

const result = await api('PUT', `/services/${SERVICE_ID}/env-vars`, key, payload);
console.log(`put_count=${payload.length} after_count=${result.length}`);
console.log(`keys=${result.map((i) => i.key || i.envVar?.key).sort().join(',')}`);
for (const item of result) {
  const k = item.key || item.envVar?.key;
  const v = item.value ?? item.envVar?.value;
  if (k && /^(DB_|REDIS_|KUDA_|CORS_|JWT_|SPRING_)/.test(k)) {
    const flag = !v ? 'EMPTY' : `SET(len=${String(v).length})`;
    console.log(`${k}=${flag}`);
  }
}
