/**
 * One-shot: verify + reset password for the Apple Review demo account on Render Postgres.
 * Does not print secrets. Usage: node scripts/provision-apple-review-user.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_YAML = path.join(os.homedir(), '.render', 'cli.yaml');
const PG_ID = 'dpg-db3b06cs728c73btuss0-a';
const API = 'https://api.render.com/v1';

const EMAIL = 'apple.review@palpeer.com';
const PASSWORD = 'AppleReview2026!';

function loadApiKey() {
  const text = fs.readFileSync(CLI_YAML, 'utf8');
  const m = text.match(/key:\s*(rnd_\w+)/);
  if (!m) throw new Error('Render API key not found in ~/.render/cli.yaml');
  return m[1];
}

async function api(method, p, key) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function externalUrl(conn) {
  const url = conn.externalConnectionString || conn.externalConnectionString?.trim;
  if (!url) throw new Error('No externalConnectionString from Render');
  return url;
}

const key = loadApiKey();
const conn = await api('GET', `/postgres/${PG_ID}/connection-info`, key);
const connectionString = externalUrl(conn);
const hash = await bcrypt.hash(PASSWORD, 10);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const before = await client.query(
    `SELECT id, email, username, status, enabled, email_verified
     FROM users WHERE lower(email) = lower($1)`,
    [EMAIL],
  );
  if (before.rowCount === 0) {
    throw new Error(`User not found: ${EMAIL}`);
  }
  const updated = await client.query(
    `UPDATE users
     SET email_verified = true,
         phone_verified = true,
         enabled = true,
         status = 'ACTIVE',
         password_hash = $2,
         updated_at = NOW()
     WHERE lower(email) = lower($1)
     RETURNING id, email, username, status, enabled, email_verified, phone_verified`,
    [EMAIL, hash],
  );
  console.log(JSON.stringify({ ok: true, user: updated.rows[0] }, null, 2));
} finally {
  await client.end();
}
