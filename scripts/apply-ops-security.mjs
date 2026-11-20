#!/usr/bin/env node
/**
 * Apply remaining ops/host security fixes against live Render + extract API SSL pins.
 *
 * - Sets OTP_LOG_CODE=false and ADMIN_MFA_REQUIRED=true
 * - Sets ADMIN_IP_ALLOWLIST only when --admin-ip= or ADMIN_IP_ALLOWLIST env is provided
 * - Ensures PUBLIC_API_BASE_URL + CORS include onrender + api/admin.palpeer.com
 * - Fills missing webhook secrets (generate or sync from repo .env); never prints secret values
 * - Registers Render custom domains api.palpeer.com / admin.palpeer.com when missing
 * - Extracts SHA-256 SPKI pin(s) into palpeer-mobile/ssl-pins.json + eas.json
 * - Optionally triggers an API deploy (--deploy)
 *
 * Usage:
 *   node scripts/apply-ops-security.mjs
 *   node scripts/apply-ops-security.mjs --deploy
 *   node scripts/apply-ops-security.mjs --admin-ip=203.0.113.10 --deploy
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_YAML = path.join(os.homedir(), '.render', 'cli.yaml');
const API = 'https://api.render.com/v1';
const SERVICE_ID = 'srv-db3ca6tg1s2s739rpof0'; // palpeer-api
const ADMIN_SERVICE_ID = 'srv-db3b9o3ncjis73f2dkmg'; // palpeer-admin
const API_HOST = 'palpeer-api.onrender.com';
const CUSTOM_API_HOST = 'api.palpeer.com';
const CUSTOM_ADMIN_HOST = 'admin.palpeer.com';
const WANT = {
  OTP_LOG_CODE: 'false',
  ADMIN_MFA_REQUIRED: 'true',
  PUBLIC_API_BASE_URL: `https://${API_HOST}`,
};
const WEBHOOK_KEYS = [
  'APAYLO_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_USERNAME',
  'KUDA_WEBHOOK_PASSWORD',
  'KORAPAY_WEBHOOK_SECRET',
  'COMPLYCUBE_WEBHOOK_SECRET',
];
/** Secrets we may generate when blank (provider dashboards must match later). */
const GENERATABLE_SECRETS = ['APAYLO_WEBHOOK_SECRET', 'KORAPAY_WEBHOOK_SECRET'];

const applyDeploy = process.argv.includes('--deploy');
const adminIpArg = process.argv.find((a) => a.startsWith('--admin-ip='))?.slice('--admin-ip='.length);

function loadApiKey() {
  const text = fs.readFileSync(CLI_YAML, 'utf8');
  const m = text.match(/key:\s*(rnd_\w+)/);
  if (!m) throw new Error('Render API key not found in ~/.render/cli.yaml');
  return m[1];
}

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1].trim()] = v;
  }
  return out;
}

function upsertDotEnv(updates) {
  const envPath = path.join(ROOT, '.env');
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text = `${text.replace(/\s*$/, '')}\n${line}\n`;
  }
  fs.writeFileSync(envPath, text);
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
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function listEnvVars(key) {
  const out = [];
  let cursor = null;
  for (;;) {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await api('GET', `/services/${SERVICE_ID}/env-vars?${q}`, key);
    const rows = Array.isArray(page) ? page : page?.envVars || [];
    for (const row of rows) {
      const item = row.envVar || row;
      if (item?.key) out.push(item);
    }
    const last = rows[rows.length - 1];
    cursor = last?.cursor || null;
    if (!cursor || rows.length < 100) break;
  }
  return out;
}

async function putEnv(key, name, value) {
  await api('PUT', `/services/${SERVICE_ID}/env-vars/${encodeURIComponent(name)}`, key, { value });
}

function present(v) {
  return v != null && String(v).trim() !== '';
}

function genSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

async function detectPublicIp() {
  const res = await fetch('https://api.ipify.org');
  if (!res.ok) throw new Error(`ipify ${res.status}`);
  return (await res.text()).trim();
}

function mergeCors(existing) {
  const want = [
    'https://admin.palpeer.com',
    'https://palpeer-admin.onrender.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const set = new Set(
    String(existing || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const o of want) set.add(o);
  return [...set].join(',');
}

function spkiPinFromPem(pem) {
  const cert = new X509Certificate(pem);
  const spki = cert.publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(spki).digest('base64');
}

function fetchPeerCerts(host, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: true,
      },
      () => {
        try {
          const peer = socket.getPeerCertificate(true);
          const chain = [];
          let current = peer;
          const seen = new Set();
          while (current && current.raw && !seen.has(current.fingerprint256)) {
            seen.add(current.fingerprint256);
            chain.push(current);
            current =
              current.issuerCertificate && current.issuerCertificate !== current
                ? current.issuerCertificate
                : null;
          }
          socket.end();
          resolve(chain);
        } catch (err) {
          socket.destroy();
          reject(err);
        }
      },
    );
    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error(`TLS timeout connecting to ${host}`));
    });
    socket.on('error', reject);
  });
}

async function extractPins(host) {
  const chain = await fetchPeerCerts(host);
  const pins = [];
  for (const cert of chain) {
    const pem = `-----BEGIN CERTIFICATE-----\n${cert.raw
      .toString('base64')
      .match(/.{1,64}/g)
      .join('\n')}\n-----END CERTIFICATE-----\n`;
    const pin = spkiPinFromPem(pem);
    pins.push({
      pin,
      subject: cert.subject?.CN || cert.subject?.O || 'unknown',
      validTo: cert.valid_to,
    });
  }
  const unique = [];
  const seen = new Set();
  for (const row of pins) {
    if (seen.has(row.pin)) continue;
    seen.add(row.pin);
    unique.push(row);
  }
  return unique;
}

function updateEasPins(pinList) {
  const easPath = path.join(ROOT, 'palpeer-mobile', 'eas.json');
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  const pinCsv = pinList.map((p) => p.pin).join(',');
  for (const profile of ['preview', 'production']) {
    if (!eas.build?.[profile]) continue;
    eas.build[profile].env = {
      ...(eas.build[profile].env || {}),
      EXPO_PUBLIC_API_SSL_PINS: pinCsv,
    };
  }
  fs.writeFileSync(easPath, `${JSON.stringify(eas, null, 2)}\n`);
  return pinCsv;
}

async function ensureCustomDomain(apiKey, serviceId, hostname) {
  try {
    const list = await api('GET', `/services/${serviceId}/custom-domains`, apiKey);
    const rows = Array.isArray(list) ? list : list?.customDomains || list || [];
    const names = rows.map((r) => (r.customDomain || r).name || r).filter(Boolean);
    if (names.includes(hostname)) {
      console.log(`custom domain ${hostname}: already registered`);
      return;
    }
  } catch (e) {
    console.log(`custom domain list failed (${e.message.slice(0, 120)}); trying create`);
  }
  try {
    await api('POST', `/services/${serviceId}/custom-domains`, apiKey, { name: hostname });
    console.log(`custom domain ${hostname}: created (add DNS CNAME → Render target, wait for cert)`);
  } catch (e) {
    console.log(`custom domain ${hostname}: ${e.message.slice(0, 240)}`);
  }
}

const key = loadApiKey();
const localEnv = loadDotEnv();
console.log('== Render env (palpeer-api) ==');

const existing = await listEnvVars(key);
const byKey = new Map(existing.map((e) => [e.key, e.value ?? '']));

for (const [name, value] of Object.entries(WANT)) {
  const before = byKey.get(name);
  if (before === value) {
    console.log(`${name}: already ${JSON.stringify(value)}`);
    continue;
  }
  await putEnv(key, name, value);
  byKey.set(name, value);
  console.log(`${name}: ${before === undefined ? 'created' : 'updated'} -> ${JSON.stringify(value)}`);
}

// Admin IP allowlist — only when explicitly requested. Auto-detecting the
// runner's public IP locks every other operator out of /api/v1/admin/**.
{
  const ip =
    (adminIpArg && adminIpArg.trim()) ||
    (process.env.ADMIN_IP_ALLOWLIST && process.env.ADMIN_IP_ALLOWLIST.trim()) ||
    '';
  if (!ip) {
    console.log(
      'ADMIN_IP_ALLOWLIST: skipped (pass --admin-ip=x.x.x.x or set ADMIN_IP_ALLOWLIST to enable)',
    );
  } else {
    const before = byKey.get('ADMIN_IP_ALLOWLIST') || '';
    if (before === ip) {
      console.log(`ADMIN_IP_ALLOWLIST: already ${ip}`);
    } else {
      await putEnv(key, 'ADMIN_IP_ALLOWLIST', ip);
      byKey.set('ADMIN_IP_ALLOWLIST', ip);
      console.log(
        `ADMIN_IP_ALLOWLIST: ${before ? 'updated' : 'created'} -> ${ip} (admin API only; change if your public IP moves)`,
      );
    }
  }
}

// CORS
{
  const next = mergeCors(byKey.get('CORS_ALLOWED_ORIGINS'));
  const before = byKey.get('CORS_ALLOWED_ORIGINS') || '';
  if (before === next) {
    console.log('CORS_ALLOWED_ORIGINS: already includes admin + localhost');
  } else {
    await putEnv(key, 'CORS_ALLOWED_ORIGINS', next);
    byKey.set('CORS_ALLOWED_ORIGINS', next);
    console.log(`CORS_ALLOWED_ORIGINS: updated (len=${next.length})`);
  }
}

console.log('\n== Webhook secrets ==');
const generatedLocal = {};
for (const name of WEBHOOK_KEYS) {
  if (present(byKey.get(name))) {
    console.log(`${name}: SET (len=${String(byKey.get(name)).length})`);
    continue;
  }
  if (present(localEnv[name])) {
    await putEnv(key, name, localEnv[name]);
    byKey.set(name, localEnv[name]);
    console.log(`${name}: synced from .env (len=${localEnv[name].length})`);
    continue;
  }
  if (GENERATABLE_SECRETS.includes(name)) {
    const secret = genSecret(32);
    await putEnv(key, name, secret);
    byKey.set(name, secret);
    generatedLocal[name] = secret;
    console.log(`${name}: generated + set on Render (len=${secret.length}) — also writing .env`);
    continue;
  }
  console.log(`${name}: MISSING`);
}

if (Object.keys(generatedLocal).length) {
  upsertDotEnv(generatedLocal);
  console.log('wrote generated secrets into local .env (gitignored)');
}

const kudaOk =
  present(byKey.get('KUDA_WEBHOOK_SECRET')) ||
  (present(byKey.get('KUDA_WEBHOOK_USERNAME')) && present(byKey.get('KUDA_WEBHOOK_PASSWORD')));
console.log(kudaOk ? 'KUDA webhook auth: OK' : 'KUDA webhook auth: MISSING');

console.log('\n== Redis ==');
for (const name of ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_SSL']) {
  console.log(`${name}: ${present(byKey.get(name)) ? 'SET' : 'MISSING'}`);
}

console.log('\n== Custom domains ==');
await ensureCustomDomain(key, SERVICE_ID, CUSTOM_API_HOST);
await ensureCustomDomain(key, ADMIN_SERVICE_ID, CUSTOM_ADMIN_HOST);
console.log(
  `DNS required at Truehost: CNAME api → ${API_HOST}; CNAME admin → palpeer-admin.onrender.com`,
);
console.log(
  `Do not flip mobile EAS API URLs until https://${CUSTOM_API_HOST}/actuator/health is UP.`,
);

console.log('\n== SSL SPKI pins ==');
const pins = await extractPins(API_HOST);
const pinsPath = path.join(ROOT, 'palpeer-mobile', 'ssl-pins.json');
fs.writeFileSync(
  pinsPath,
  `${JSON.stringify({ host: API_HOST, extractedAt: new Date().toISOString(), pins }, null, 2)}\n`,
);
const pinCsv = updateEasPins(pins.slice(0, 2));
console.log(`host=${API_HOST}`);
for (const p of pins) {
  console.log(`  ${p.pin}  (${p.subject}; until ${p.validTo})`);
}
console.log(`wrote ${path.relative(ROOT, pinsPath)}`);
console.log(`updated eas.json preview/production EXPO_PUBLIC_API_SSL_PINS (${pinCsv.split(',').length} pins)`);

if (applyDeploy) {
  console.log('\n== Triggering API deploy ==');
  const deploy = await api('POST', `/services/${SERVICE_ID}/deploys`, key, {
    clearCache: 'do_not_clear',
  });
  console.log(`deploy id=${deploy?.id || deploy?.deploy?.id || 'ok'}`);
} else {
  console.log('\nEnv changes saved on Render. Re-run with --deploy to ship.');
}

const stillMissing = WEBHOOK_KEYS.filter((n) => !present(byKey.get(n)));
// KUDA_WEBHOOK_SECRET optional when user/pass set
const criticalMissing = stillMissing.filter((n) => {
  if (n === 'KUDA_WEBHOOK_SECRET' && kudaOk) return false;
  if (n === 'KUDA_WEBHOOK_USERNAME' || n === 'KUDA_WEBHOOK_PASSWORD') return !kudaOk;
  return true;
});
if (criticalMissing.length) {
  console.log(`\nWARNING: still missing: ${criticalMissing.join(', ')}`);
  process.exitCode = 2;
} else {
  console.log('\nWebhook auth coverage: OK');
}
