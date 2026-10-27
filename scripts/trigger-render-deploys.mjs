#!/usr/bin/env node
/** Force-deploy palpeer-api and palpeer-admin on Render. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI_YAML = path.join(os.homedir(), '.render', 'cli.yaml');
const API = 'https://api.render.com/v1';
const NAMES = new Set(['palpeer-api', 'palpeer-admin']);

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
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const key = loadApiKey();
const listed = await api('GET', '/services?limit=50', key);
const rows = Array.isArray(listed) ? listed : listed?.items || [];
const targets = [];
for (const row of rows) {
  const s = row.service || row;
  if (NAMES.has(s.name)) targets.push({ name: s.name, id: s.id });
}

if (targets.length === 0) {
  // Fallback known API id from prior scripts
  targets.push({ name: 'palpeer-api', id: 'srv-db3ca6tg1s2s739rpof0' });
}

for (const t of targets) {
  const deploy = await api('POST', `/services/${t.id}/deploys`, key, {
    clearCache: 'do_not_clear',
  });
  const id = deploy?.id || deploy?.deploy?.id || 'ok';
  console.log(`${t.name}\t${t.id}\tdeploy=${id}`);
}
