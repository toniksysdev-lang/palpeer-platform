/**
 * Ensure an email is an enabled SUPER_ADMIN operator (prod/dev DB via Render).
 *
 * Usage:
 *   node scripts/ensure-admin-operator.mjs samuel.adeola@palpeer.com
 *   node scripts/ensure-admin-operator.mjs --dry-run samuel.adeola@palpeer.com
 *
 * Reads Render API key from ~/.render/cli.yaml and Postgres connection from
 * the palpeer-db connection-info endpoint (password never printed).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const API = 'https://api.render.com/v1';
const PG_ID = 'dpg-db3b06cs728c73btuss0-a';
const SUPER_ADMIN = 'SUPER_ADMIN';

const dryRun = process.argv.includes('--dry-run');
const emailArg = process.argv.find((a) => a.includes('@'));
if (!emailArg) {
  console.error('Usage: node scripts/ensure-admin-operator.mjs [--dry-run] email@example.com');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();

function loadApiKey() {
  const text = fs.readFileSync(path.join(os.homedir(), '.render', 'cli.yaml'), 'utf8');
  const m = text.match(/key:\s*(rnd_\w+)/);
  if (!m) throw new Error('Render API key not found in ~/.render/cli.yaml');
  return m[1];
}

async function renderGet(key, p) {
  const res = await fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const key = loadApiKey();
const connPayload = await renderGet(key, `/postgres/${PG_ID}/connection-info`);
const conn = connPayload.connectionInfo || connPayload;
const connectionString = conn.externalConnectionString;
if (!connectionString) throw new Error('No externalConnectionString from Render');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  const userRes = await client.query(
    `SELECT id, email, enabled, email_verified, status
     FROM users WHERE lower(email) = $1`,
    [email],
  );
  if (userRes.rowCount === 0) {
    console.error(`User not found: ${email}`);
    process.exit(2);
  }
  const user = userRes.rows[0];
  console.log(
    `user id=${user.id} enabled=${user.enabled} email_verified=${user.email_verified} status=${user.status}`,
  );

  const adminRes = await client.query(
    `SELECT a.id, a.enabled,
            coalesce(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
     FROM admin_users a
     LEFT JOIN admin_user_roles aur ON aur.admin_user_id = a.id
     LEFT JOIN admin_roles r ON r.id = aur.role_id
     WHERE a.user_id = $1
     GROUP BY a.id, a.enabled`,
    [user.id],
  );

  const roleRes = await client.query(`SELECT id FROM admin_roles WHERE code = $1`, [SUPER_ADMIN]);
  if (roleRes.rowCount === 0) throw new Error(`${SUPER_ADMIN} role missing`);
  const roleId = roleRes.rows[0].id;

  if (adminRes.rowCount === 0) {
    console.log('admin_users: missing');
    if (dryRun) {
      console.log('dry-run: would create admin_users + SUPER_ADMIN + verify email');
      process.exit(0);
    }
    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET email_verified = true, enabled = true,
         status = CASE WHEN status IS NULL OR status = 'PENDING_VERIFICATION' THEN 'ACTIVE' ELSE status END
       WHERE id = $1`,
      [user.id],
    );
    const inserted = await client.query(
      `INSERT INTO admin_users (id, user_id, enabled, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, true, now(), now())
       RETURNING id`,
      [user.id],
    );
    const adminId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO admin_user_roles (admin_user_id, role_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminId, roleId],
    );
    await client.query('COMMIT');
    console.log(`created SUPER_ADMIN for ${email}`);
  } else {
    const admin = adminRes.rows[0];
    const roles = admin.roles || [];
    console.log(`admin_users: id=${admin.id} enabled=${admin.enabled} roles=${roles.join(',') || '(none)'}`);
    const needsEnable = !admin.enabled;
    const needsRole = !roles.includes(SUPER_ADMIN);
    const needsVerify = !user.email_verified || !user.enabled;
    if (!needsEnable && !needsRole && !needsVerify) {
      console.log('already authorized; no changes');
      process.exit(0);
    }
    if (dryRun) {
      console.log(
        `dry-run: would ${[
          needsEnable ? 'enable admin' : null,
          needsRole ? 'add SUPER_ADMIN' : null,
          needsVerify ? 'verify/enable user' : null,
        ]
          .filter(Boolean)
          .join(', ')}`,
      );
      process.exit(0);
    }
    await client.query('BEGIN');
    if (needsVerify) {
      await client.query(
        `UPDATE users SET email_verified = true, enabled = true,
           status = CASE WHEN status IS NULL OR status = 'PENDING_VERIFICATION' THEN 'ACTIVE' ELSE status END
         WHERE id = $1`,
        [user.id],
      );
    }
    if (needsEnable) {
      await client.query(`UPDATE admin_users SET enabled = true, updated_at = now() WHERE id = $1`, [
        admin.id,
      ]);
    }
    if (needsRole) {
      await client.query(
        `INSERT INTO admin_user_roles (admin_user_id, role_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [admin.id, roleId],
      );
    }
    await client.query('COMMIT');
    console.log(`updated admin authorization for ${email}`);
  }

  const check = await client.query(
    `SELECT a.enabled,
            coalesce(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
     FROM admin_users a
     LEFT JOIN admin_user_roles aur ON aur.admin_user_id = a.id
     LEFT JOIN admin_roles r ON r.id = aur.role_id
     WHERE a.user_id = $1
     GROUP BY a.enabled`,
    [user.id],
  );
  const row = check.rows[0];
  console.log(`result enabled=${row.enabled} roles=${(row.roles || []).join(',')}`);
} catch (err) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ignore
  }
  throw err;
} finally {
  await client.end();
}
