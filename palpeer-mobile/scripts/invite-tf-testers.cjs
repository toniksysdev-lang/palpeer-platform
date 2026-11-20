/**
 * Ensure TestFlight external testers (add Cecilia if missing), then resend invites.
 * Excludes any email containing "covenant".
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const ASC_APP_ID = '6826088742';
const ACCOUNT = 'toniksystemslab';
const EXCLUDE_SUBSTRING = 'covenant';
const ENSURE_EMAILS = ['obianujucecilia2001@gmail.com'];

function loadSession() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, '.expo', 'state.json'), 'utf8'),
  );
  const session = state?.auth?.sessionSecret || state?.sessionSecret;
  if (!session) throw new Error('No Expo session in ~/.expo/state.json — run eas login');
  return session;
}

async function gql(session, query, variables = {}) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'expo-session': session,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt({ keyP8, keyId, issuerId }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }),
  );
  const data = `${header}.${payload}`;
  const key = crypto.createPrivateKey(keyP8);
  const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

async function asc(jwt, method, urlPath, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} -> ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function listAllTesters(jwt, groupId) {
  const out = [];
  let url = `/v1/betaGroups/${groupId}/betaTesters?limit=200`;
  while (url) {
    const page = await asc(jwt, 'GET', url);
    for (const t of page.data || []) {
      out.push({
        id: t.id,
        email: t.attributes?.email,
        firstName: t.attributes?.firstName,
        lastName: t.attributes?.lastName,
      });
    }
    const next = page.links?.next;
    url = next ? next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return out;
}

async function latestBuildId(jwt) {
  const page = await asc(
    jwt,
    'GET',
    `/v1/builds?filter[app]=${ASC_APP_ID}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired`,
  );
  const builds = page.data || [];
  for (const b of builds) {
    const state = (b.attributes?.processingState || '').toUpperCase();
    if (b.attributes?.expired) continue;
    if (state === 'FAILED' || state === 'INVALID') continue;
    return { id: b.id, version: b.attributes?.version, state };
  }
  if (builds[0]) {
    return {
      id: builds[0].id,
      version: builds[0].attributes?.version,
      state: builds[0].attributes?.processingState,
    };
  }
  return null;
}

async function ensureTester(jwt, email) {
  const existing = await listAllTesters(jwt, BETA_GROUP);
  const hit = existing.find((t) => (t.email || '').toLowerCase() === email.toLowerCase());
  if (hit) {
    console.log('alreadyInGroup=' + email);
    return hit;
  }
  try {
    const created = await asc(jwt, 'POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email, firstName: email.split('@')[0], lastName: 'Tester' },
        relationships: {
          betaGroups: { data: [{ type: 'betaGroups', id: BETA_GROUP }] },
          apps: { data: [{ type: 'apps', id: ASC_APP_ID }] },
        },
      },
    });
    console.log('createdTester=' + email + ' id=' + created.data?.id);
    return { id: created.data.id, email };
  } catch (e) {
    console.log(
      'create failed ' + email + ' status=' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300),
    );
    const search = await asc(
      jwt,
      'GET',
      `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&filter[apps]=${ASC_APP_ID}&limit=5`,
    );
    const found = (search.data || [])[0];
    if (!found) throw e;
    await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
      data: [{ type: 'betaTesters', id: found.id }],
    });
    console.log('attachedExisting=' + email + ' id=' + found.id);
    return { id: found.id, email };
  }
}

(async () => {
  const session = loadSession();
  const listData = await gql(
    session,
    `
    query ($accountName: String!) {
      account {
        byName(accountName: $accountName) {
          id
          appStoreConnectApiKeysPaginated(first: 20) {
            edges { node { id name keyIdentifier issuerIdentifier } }
          }
        }
      }
    }
  `,
    { accountName: ACCOUNT },
  );
  const keys = listData.account.byName.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
  if (!keys.length) throw new Error('No ASC API keys on Expo account');

  let jwt = null;
  let used = null;
  for (const k of keys) {
    try {
      const detail = await gql(
        session,
        `
        query ($id: ID!) {
          appStoreConnectApiKey { byId(id: $id) { id keyIdentifier issuerIdentifier keyP8 } }
        }
      `,
        { id: k.id },
      );
      const key = detail.appStoreConnectApiKey.byId;
      jwt = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      used = key.keyIdentifier;
      await asc(jwt, 'GET', `/v1/betaGroups/${BETA_GROUP}`);
      break;
    } catch (e) {
      console.log(`key ${k.keyIdentifier} failed: ${e.message}`);
      jwt = null;
    }
  }
  if (!jwt) throw new Error('No working ASC API key');
  console.log('usingKey=' + used);

  for (const email of ENSURE_EMAILS) {
    if (email.toLowerCase().includes(EXCLUDE_SUBSTRING)) continue;
    await ensureTester(jwt, email);
  }

  const testers = await listAllTesters(jwt, BETA_GROUP);
  console.log('testerCount=' + testers.length);

  const excluded = [];
  const invitees = [];
  for (const t of testers) {
    const email = (t.email || '').toLowerCase();
    if (!email) continue;
    if (email.includes(EXCLUDE_SUBSTRING)) {
      excluded.push(email);
      continue;
    }
    invitees.push(t);
  }
  console.log('excluded=' + JSON.stringify(excluded));
  console.log('inviteCount=' + invitees.length);
  console.log(
    'inviteEmails=' +
      invitees
        .map((t) => t.email)
        .sort()
        .join(','),
  );

  const build = await latestBuildId(jwt);
  console.log('latestBuild=' + JSON.stringify(build));

  const results = { invited: [], relinked: [], failed: [] };

  for (const t of invitees) {
    const email = t.email;
    let invited = false;
    if (build?.id) {
      try {
        await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              build: { data: { type: 'builds', id: build.id } },
              betaTester: { data: { type: 'betaTesters', id: t.id } },
            },
          },
        });
        results.invited.push(email);
        invited = true;
        console.log('invited ' + email);
      } catch (invErr) {
        console.log(
          'inviteAPI failed ' +
            email +
            ' status=' +
            invErr.status +
            ' ' +
            JSON.stringify(invErr.body || {}).slice(0, 240),
        );
      }
    }
    if (invited) continue;

    try {
      try {
        await asc(jwt, 'DELETE', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: t.id }],
        });
      } catch {
        /* ignore */
      }
      await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id: t.id }],
      });
      results.relinked.push(email);
      console.log('relinked ' + email);
    } catch (relinkErr) {
      results.failed.push({ email, status: relinkErr.status, body: relinkErr.body });
      console.log('failed ' + email + ' status=' + relinkErr.status);
    }
  }

  console.log(
    JSON.stringify(
      {
        excluded,
        invited: results.invited.length,
        relinked: results.relinked.length,
        failed: results.failed.length,
        invitedEmails: results.invited,
        relinkedEmails: results.relinked,
        failedEmails: results.failed.map((f) => f.email),
        build,
        ensured: ENSURE_EMAILS,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error('FATAL', e.message);
  if (e.body) console.error(JSON.stringify(e.body).slice(0, 800));
  process.exit(1);
});
