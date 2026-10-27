#!/usr/bin/env node
/**
 * Apply remaining ops/host security fixes against live Render + extract API SSL pins.
 *
 * - Sets OTP_LOG_CODE=false and ADMIN_MFA_REQUIRED=true (per-key PUT — never replaces all env)
 * - Audits webhook-related env vars (SET / MISSING, no secret values printed)
 * - Extracts SHA-256 SPKI pin(s) for the API host into palpeer-mobile/ssl-pins.json
 * - Optionally triggers an API deploy (--deploy)
 *
 * Usage:
 *   node scripts/apply-ops-security.mjs
 *   node scripts/apply-ops-security.mjs --deploy
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
const API_HOST = 'palpeer-api.onrender.com';
const WANT = {
  OTP_LOG_CODE: 'false',
  ADMIN_MFA_REQUIRED: 'true',
};
const WEBHOOK_KEYS = [
  'APAYLO_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_USERNAME',
  'KUDA_WEBHOOK_PASSWORD',
  'KORAPAY_WEBHOOK_SECRET',
  'COMPLYCUBE_WEBHOOK_SECRET',
];

const applyDeploy = process.argv.includes('--deploy');

function loadApiKey() {
  const text = fs.readFileSync(CLI_YAML, 'utf8');
  const m = text.match(/key:\s*(rnd_\w+)/);
  if (!m) throw new Error('Render API key not found in ~/.render/cli.yaml');
  return m[1];
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
    const next =
      (Array.isArray(page) ? null : page?.cursor) ||
      rows[rows.length - 1]?.cursor ||
      null;
    // Render paginates via Link / cursor on last item in some versions
    const last = rows[rows.length - 1];
    cursor = last?.cursor || null;
    if (!cursor || rows.length < 100) break;
  }
  return out;
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
            current = current.issuerCertificate && current.issuerCertificate !== current
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
    const pem = `-----BEGIN CERTIFICATE-----\n${cert.raw.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
    const pin = spkiPinFromPem(pem);
    pins.push({
      pin,
      subject: cert.subject?.CN || cert.subject?.O || 'unknown',
      validTo: cert.valid_to,
    });
  }
  // Deduplicate
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

const key = loadApiKey();
console.log('== Render env (palpeer-api) ==');

const existing = await listEnvVars(key);
const byKey = new Map(existing.map((e) => [e.key, e.value ?? '']));

for (const [name, value] of Object.entries(WANT)) {
  const before = byKey.get(name);
  const already = before === value;
  if (already) {
    console.log(`${name}: already ${JSON.stringify(value)}`);
    continue;
  }
  await api('PUT', `/services/${SERVICE_ID}/env-vars/${encodeURIComponent(name)}`, key, { value });
  console.log(`${name}: ${before === undefined ? 'created' : 'updated'} -> ${JSON.stringify(value)}`);
}

console.log('\n== Webhook secret audit (values hidden) ==');
let missingCritical = 0;
for (const name of WEBHOOK_KEYS) {
  const v = byKey.get(name);
  // Refresh map for keys we may have just set (webhook keys unchanged)
  const present = v != null && String(v).trim() !== '';
  if (!present) {
    // Re-fetch single key state from original list only
    console.log(`${name}: MISSING`);
    if (name.endsWith('_SECRET') || name === 'KUDA_WEBHOOK_USERNAME' || name === 'KUDA_WEBHOOK_PASSWORD') {
      missingCritical += 1;
    }
  } else {
    console.log(`${name}: SET (len=${String(v).length})`);
  }
}

// Kuda can use username/password OR secret
const kudaOk =
  (byKey.get('KUDA_WEBHOOK_SECRET') && String(byKey.get('KUDA_WEBHOOK_SECRET')).trim()) ||
  (byKey.get('KUDA_WEBHOOK_USERNAME') &&
    byKey.get('KUDA_WEBHOOK_PASSWORD') &&
    String(byKey.get('KUDA_WEBHOOK_USERNAME')).trim() &&
    String(byKey.get('KUDA_WEBHOOK_PASSWORD')).trim());
if (!kudaOk) {
  console.log('KUDA webhook auth: MISSING (need SECRET or USERNAME+PASSWORD)');
} else {
  console.log('KUDA webhook auth: OK');
}

console.log('\n== SSL SPKI pins ==');
const pins = await extractPins(API_HOST);
const pinsPath = path.join(ROOT, 'palpeer-mobile', 'ssl-pins.json');
fs.writeFileSync(
  pinsPath,
  `${JSON.stringify({ host: API_HOST, extractedAt: new Date().toISOString(), pins }, null, 2)}\n`,
);
const pinCsv = updateEasPins(pins.slice(0, 2)); // leaf + first intermediate
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
  console.log('\nEnv changes are saved on Render but not deployed. Re-run with --deploy to ship.');
}

if (missingCritical > 0) {
  console.log(
    `\nWARNING: ${missingCritical} webhook-related env vars are missing. Set them in the Render dashboard (or local .env then a careful sync). Fail-closed code will reject those webhooks until set.`,
  );
  process.exitCode = 2;
}
