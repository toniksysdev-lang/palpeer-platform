#!/usr/bin/env node
/** Push webhook secrets from local .env to Render (per-key). Never prints secret values. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_YAML = path.join(os.homedir(), '.render', 'cli.yaml');
const API = 'https://api.render.com/v1';
const SERVICE_ID = 'srv-db3ca6tg1s2s739rpof0';
const KEYS = [
  'APAYLO_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_SECRET',
  'KUDA_WEBHOOK_USERNAME',
  'KUDA_WEBHOOK_PASSWORD',
  'KORAPAY_WEBHOOK_SECRET',
  'COMPLYCUBE_WEBHOOK_SECRET',
];

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

async function putEnv(key, name, value) {
  const res = await fetch(`${API}/services/${SERVICE_ID}/env-vars/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT ${name} -> ${res.status} ${text.slice(0, 300)}`);
}

const apiKey = loadApiKey();
const local = loadDotenv(path.join(ROOT, '.env'));
let pushed = 0;
let missing = 0;
for (const name of KEYS) {
  const v = local[name];
  if (!v || !String(v).trim()) {
    console.log(`${name}: LOCAL_MISSING (skipped)`);
    missing += 1;
    continue;
  }
  await putEnv(apiKey, name, v);
  console.log(`${name}: pushed (len=${String(v).length})`);
  pushed += 1;
}
console.log(`pushed=${pushed} local_missing=${missing}`);
if (pushed > 0) {
  console.log('Re-run: node scripts/apply-ops-security.mjs --deploy');
}
